import express from "express"
import cors from "cors"
import "dotenv/config";
import { MongoClient } from 'mongodb';
const app = express()
const PORT = 8000
app.use(cors());


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
app.post("/addStudio",(req,res)=>{
	const data=req.body
	console.log(data)
	res.send({msg:"API is working"})
})











app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})