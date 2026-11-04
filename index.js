import express from "express"
import cors from "cors"
import "dotenv/config";
import { MongoClient, ObjectId } from 'mongodb';
const app = express()
const PORT = 8000
app.use(cors());
app.use(express.json())


const client = new MongoClient(process.env.MONGO_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const mongoCLient=await connectToMongoDB();
const db=mongoCLient.db("StudioSpace")
const newStudioCollection=db.collection("newStudio")
const bookingCollection=db.collection("BookedItems")
app.post("/addStudio", async (req, res) => {
  const studio = req.body;

  const alreadyAdded = await newStudioCollection.findOne({
    ownerEmail: studio.ownerEmail,
  });

  if (alreadyAdded) {
    return res
      .status(409)
      .send({ message: "You have already added a studio with this email." });
  }

  studio.createdAt = new Date();
  const result = await newStudioCollection.insertOne(studio);
  res.send(result);
});




app.get("/getStudio", async (req, res) => {
  const result = await newStudioCollection
    .find()
    .sort({ _id: -1 }) // newest first
    .limit(6)
    .toArray();
  res.send(result);
});
app.get("/getStudio/:id",async(req,res)=>{
	const {id}=req.params
	const result=await newStudioCollection.findOne({_id:new ObjectId(id)})
	console.log(id)
	res.send(result)
})

app.get("/getStudios",async (req,res)=>{
	const result=await newStudioCollection.find().toArray()
	res.send(result)
})
app.post('/booked',async (req,res)=>{
	const data=req.body
	const result=await bookingCollection.insertOne(data)
	res.send(result)
})
app.get("/bookedStudio/:email", async(req,res)=>{
	const {email}=req.params
	const result=await bookingCollection.find({"user.email":email}).toArray()
	res.send(result)
})

app.delete("/bookings/:id", async (req,res)=>{
	const {id}=req.params
	const result=await bookingCollection.deleteOne({_id:new ObjectId(id)})
	res.send(result)
})

app.patch("/editStudio/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

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

app.get("/myStudioes/:email",async(req,res)=>{
	const {email}=req.params
	const result=await newStudioCollection.find({ownerEmail:email}).toArray()
	res.send(result)
})
app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})