const express = require("express");
const cors = require("cors");

require("dotenv").config();
const port = process.env.PORT || 3000;

const stripe = require("stripe")(process.env.STRIPE_KEY);
const crypto = require("crypto");

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
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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

    const usersCollection = database.collection("users");
    const requestsCollection = database.collection("requests");
    const paymentCollection = database.collection("payments");

    // Donor Registration
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      userInfo.createdAt = new Date();
      userInfo.role = "Donor";
      userInfo.status = "active";

      const result = await usersCollection.insertOne(userInfo);

      res.send(result);
    });

    // Registration
    app.get("/users", verifyFBToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.status(200).send(result);
    });

    // Requests
    app.post("/requests", verifyFBToken, async (req, res) => {
      const data = req.body;
      data.createdAt = new Date();
      const result = await requestsCollection.insertOne(data);
      res.send(result);
    });

    // Request Detail Page
    app.get("/requests/:id", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const result = await requestsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // User Dashboard - User's Last 3 Donation Requests
    app.get(
      "/my-donation-requests-recent",
      verifyFBToken,
      async (req, res) => {
        const result = await requestsCollection.find().sort({ createdAt: -1 }).limit(3).toArray();
        res.status(200).send(result);
      }
    );

    // User Dashboard - My Donation Requests
    app.get("/my-donation-requests", verifyFBToken, async (req, res) => {
      const email = req.decoded_email;
      const page = Number(req.query.page);
      const size = Number(req.query.size);
      const status = req.query.status;

      console.log(status);

      const query = { requesterEmail: email };

      if (status) {
        query.request_status = status;
      }

      const result = await requestsCollection
        .find(query)
        .limit(size)
        .skip(page * size)
        .toArray();

      const totalRequest = await requestsCollection.countDocuments(query);

      res.send({ result: result, totalRequest });
    });

    app.get(`/users/role/:email`, async (req, res) => {
      const { email } = req.params;

      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // User request status change ig. pending / in progress / done
    app.patch(
      "/update/user/request-status",
      verifyFBToken,
      async (req, res) => {
        const { _id, request_status } = req.query;
        // console.log(_id, request_status); 676c5aef5c9384a8384b7d09 inprogress
        const query = { _id: new ObjectId(_id) };

        const updateRequestStatus = {
          $set: {
            request_status: request_status,
          },
        };

        const result = await requestsCollection.updateOne(
          query,
          updateRequestStatus
        );
        res.send(result);
      }
    );

    // User status change ig. block users
    app.patch("/update/user/status", verifyFBToken, async (req, res) => {
      const { email, status } = req.query;
      const query = { email: email };

      const updateStatus = {
        $set: {
          status: status,
        },
      };

      const result = await usersCollection.updateOne(query, updateStatus);
      res.send(result);
    });

    // User role change ig. make user to volunteer
    app.patch("/update/user/role", verifyFBToken, async (req, res) => {
      const { email, role } = req.query;
      const query = { email: email };

      const updatedRole = {
        $set: {
          role: role,
        },
      };

      const result = await usersCollection.updateOne(query, updatedRole);
      res.send(result);
    });

    // Homepage Search
    app.get("/search-request", async (req, res) => {
      const { blood, district, upazila, status } = req.query;

      const query = {};

      if (!query) {
        return;
      }

      if (blood) {
        query.bloodGroup = blood;
      }

      if (district) {
        query.district = district;
      }

      if (upazila) {
        query.upazila = upazila;
      }

      if (status) {
        query.request_status = status;
      }

      const result = await requestsCollection.find(query).toArray();
      res.send(result);
    });

    // Homepage Donor - Stripe Payment
    app.post("/create-payment-checkout", async (req, res) => {
      const information = req.body;
      const amount = parseInt(information.donateAmount) * 100;

      const session = await stripe.checkout.sessions.create({
        success_url: "https://example.com/success",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: "Please Donate",
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          donorName: information.donorName,
        },
        customer_email: information.donorEmail,
        success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
      });

      res.send({ url: session.url });
    });

    // Get blood donation requests information
    app.get(
      "/get-blood-donation-requests-info",
      verifyFBToken,
      async (req, res) => {
        const result = await requestsCollection.find().toArray();
        res.status(200).send(result);
      }
    );

    // Get total funding information
    app.get("/funding", verifyFBToken, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.status(200).send(result);
    });

    app.post("/success-payment", async (req, res) => {
      const { session_id } = req.query;
      const session = await stripe.checkout.sessions.retrieve(session_id);

      const transactionId = session.payment_intent;

      const isPaymentExist = await paymentCollection.findOne({ transactionId });

      if (isPaymentExist) {
        return;
      }
      if (session.payment_status == "paid") {
        const paymentInfo = {
          amount: session.amount_total / 100,
          currency: session.currency,
          donorEmail: session.customer_email,
          transactionId,
          payment_status: session.payment_status,
          paidAt: new Date(),
        };
        const result = await paymentCollection.insertOne(paymentInfo);

        return res.send(result);
      }
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
