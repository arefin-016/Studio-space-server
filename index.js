import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

const mongoClient = await connectToMongoDB();

const db = mongoClient.db("StudioSpace");

const newStudioCollection = db.collection("newStudio");
const bookingCollection = db.collection("BookedItems");
app.delete('/studios/:email',async(req,res)=>{

	const {email}=req.params
	const result=await newStudioCollection.deleteOne({ownerEmail:email})
	res.send(result)
})

// Owner updates their own added studio — matched by owner email, so a
// request can only ever touch the studio belonging to that email.
app.patch("/studios/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const data = { ...req.body };

    // Ownership and document identity can't be changed through this route
    delete data._id;
    delete data.ownerEmail;
    delete data.ownerName;
    delete data.createdAt;

    const result = await newStudioCollection.updateOne(
      { ownerEmail: email },
      { $set: data }
    );

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .send({ message: "No studio found for this email" });
    }

    res.send({
      message: "Studio updated successfully",
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to update studio" });
  }
});

app.post("/addStudio", async (req, res) => {
  try {
    const studio = req.body;

    const alreadyAdded = await newStudioCollection.findOne({
      ownerEmail: studio.ownerEmail,
    });

    if (alreadyAdded) {
      return res.status(409).send({
        message: "You have already added a studio with this email.",
      });
    }

    studio.createdAt = new Date();

    const result = await newStudioCollection.insertOne(studio);

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to add studio" });
  }
});

app.get("/getStudio", async (req, res) => {
  try {
    const result = await newStudioCollection
      .find()
      .sort({ _id: -1 })
      .limit(6)
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch studios" });
  }
});

app.get("/getStudio/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid studio ID" });
    }

    const result = await newStudioCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      return res.status(404).send({ message: "Studio not found" });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch studio" });
  }
});

app.get("/getStudios", async (req, res) => {
  try {
    const result = await newStudioCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch studios" });
  }
});

app.get("/myStudioes/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const result = await newStudioCollection
      .find({ ownerEmail: email })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch owner studios" });
  }
});

app.post("/booked", async (req, res) => {
  try {
    const data = req.body;

    // Derive the studio owner's email from the studio document on the
    // server — never from the client payload. confirmBooking /
    // rejectBooking / bookingRequests all match on this field.
    let ownerEmail = null;
    const studioId = data?.studio?.id;

    if (studioId && ObjectId.isValid(String(studioId))) {
      const studio = await newStudioCollection.findOne({
        _id: new ObjectId(String(studioId)),
      });
      ownerEmail = studio?.ownerEmail ?? null;
    }

    const newBooking = {
      ...data,
      ownerEmail,
      status: "Pending",
      createdAt: new Date(),
    };

    const result = await bookingCollection.insertOne(newBooking);

    res.send({
      success: true,
      message: "Booking created successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to create booking" });
  }
});

app.get('/studios/category/:category', async (req, res) => {
  const category = req.params.category;

  const result = await newStudioCollection
    .find({ category: category })
    .toArray();

  res.send(result);
});


app.get("/bookedStudio/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const result = await bookingCollection
      .find({ "user.email": email })
      .sort({ createdAt: -1 })
      .toArray();

    // Studio documents store their name as `title` (and older bookings were
    // saved without a studio name at all). Fill it in from the studio
    // document so the bookings list can show the real studio name.
    const studioIds = [
      ...new Set(
        result
          .map((item) => String(item?.studio?.id ?? ""))
          .filter((id) => id && ObjectId.isValid(id))
      ),
    ];

    if (studioIds.length > 0) {
      const studios = await newStudioCollection
        .find(
          { _id: { $in: studioIds.map((id) => new ObjectId(id)) } },
          { projection: { title: 1, name: 1 } }
        )
        .toArray();

      const names = new Map(
        studios.map((studio) => [
          String(studio._id),
          studio.name ?? studio.title,
        ])
      );

      for (const item of result) {
        const studioName = names.get(String(item?.studio?.id ?? ""));
        if (studioName && item.studio && !item.studio.name) {
          item.studio.name = studioName;
        }
      }
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch bookings" });
  }
});

app.get("/bookingRequests", async (req, res) => {
  try {
    const ownerEmail = req.query.email;

    if (!ownerEmail) {
      return res.status(400).send({
        message: "Owner email is required",
      });
    }

    const result = await bookingCollection
      .find({ ownerEmail: ownerEmail })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error(error);

    res.status(500).send({
      message: "Failed to fetch booking requests",
    });
  }
});

app.patch("/confirmBooking/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const ownerEmail = req.body.ownerEmail;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid booking ID",
      });
    }

    if (!ownerEmail) {
      return res.status(400).send({
        message: "Owner email is required",
      });
    }

    const result = await bookingCollection.updateOne(
      {
        _id: new ObjectId(id),
        ownerEmail: ownerEmail,
        status: "Pending",
      },
      {
        $set: {
          status: "Confirmed",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Booking not found or cannot be confirmed",
      });
    }

    res.send({
      success: true,
      message: "Booking confirmed successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({
      message: "Failed to confirm booking",
    });
  }
});

app.patch("/rejectBooking/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const ownerEmail = req.body.ownerEmail;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid booking ID",
      });
    }

    if (!ownerEmail) {
      return res.status(400).send({
        message: "Owner email is required",
      });
    }

    const result = await bookingCollection.updateOne(
      {
        _id: new ObjectId(id),
        ownerEmail: ownerEmail,
        status: "Pending",
      },
      {
        $set: {
          status: "Cancelled",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Booking not found or cannot be rejected",
      });
    }

    res.send({
      success: true,
      message: "Booking rejected successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({
      message: "Failed to reject booking",
    });
  }
});

app.delete("/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid booking ID" });
    }

    const result = await bookingCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to delete booking" });
  }
});

app.patch("/editStudio/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid booking ID" });
    }

    const result = await bookingCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          "booking.date": data.date,
          "booking.startTime": data.startTime,
          "booking.duration": Number(data.duration),
          "booking.totalPrice": Number(data.totalPrice),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        message: "Booking not found",
      });
    }

    res.send({
      message: "Booking updated successfully",
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to update booking",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});