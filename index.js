const express = require("express");
const cors = require("cors");

require("dotenv").config();
const port = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("decoded info", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
};

var admin = require("firebase-admin");

// Use the service account from env variable
const decoded = Buffer.from(process.env.FIREBASE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// MongoDB
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const database = client.db("missionscic11mission");

    const userCollections = database.collection("user");
    const requestCollections = database.collection("request");

    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      userInfo.createdAt = new Date();
      userInfo.role = "Donor";
      userInfo.status = "active";

      const result = await userCollections.insertOne(userInfo);

      res.send(result);
    });

    app.get("/users", verifyFBToken, async (req, res) => {
      const result = await userCollections.find().toArray();
      res.status(200).send(result);
    });

    // Requests
    app.post("/requests", verifyFBToken, async (req, res) => {
      const data = req.body;
      data.createdAt = new Date();
      const result = await requestCollections.insertOne(data);
      res.send(result);
    });

    app.get(`/users/role/:email`, async (req, res) => {
      const { email } = req.params;

      const query = { email: email };
      const result = await userCollections.findOne(query);
      console.log(result);
      res.send(result);
    });

    app.patch("/update/user/status", verifyFBToken, async (req, res) => {
      const { email, status } = req.query;
      const query = { email: email };

      const updateStatus = {
        $set: {
          status: status,
        },
      };

      const result = await userCollections.updateOne(query, updateStatus);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello, Mission SCIC");
});

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
