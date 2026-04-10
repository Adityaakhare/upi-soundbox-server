const express = require('express');
const Razorpay = require("razorpay");
const mqtt = require('mqtt');
const crypto = require('crypto');
const path = require("path");

const app = express();

// ENV VARIABLES
const AIO_USERNAME = process.env.AIO_USERNAME;
const AIO_KEY = process.env.AIO_KEY;
const RAZORPAY_SECRET = process.env.RAZORPAY_SECRET;

const MQTT_TOPIC = `${AIO_USERNAME}/feeds/upi-payment`;
const PORT = process.env.PORT || 3000;

// Razorpay
const razorpay = new Razorpay({
  key_id: process.env.KEY_ID,
  key_secret: process.env.KEY_SECRET
});

// MQTT
const client = mqtt.connect('mqtt://io.adafruit.com', {
  username: AIO_USERNAME,
  password: AIO_KEY
});

client.on('connect', () => {
  console.log("MQTT Connected");
});

// Webhook
app.use('/webhook', express.raw({ type: 'application/json' }));

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  const expected = crypto
    .createHmac('sha256', RAZORPAY_SECRET)
    .update(req.body)
    .digest('hex');

  if (signature !== expected) {
    return res.status(400).send("Invalid signature");
  }

  const data = JSON.parse(req.body);
  const amount = data.payload.payment.entity.amount / 100;

  console.log("Payment:", amount);

  client.publish(MQTT_TOPIC, amount.toString());

  res.send("OK");
});

// Homepage (HTML)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Test route
app.get('/test/:amount', (req, res) => {
  const amount = req.params.amount;

  client.publish(MQTT_TOPIC, amount.toString());

  console.log("Test Payment:", amount);

  res.send("Sent: " + amount);
});

// Create order
app.get("/create-order/:amount", async (req, res) => {
  try {
    const amount = req.params.amount;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR"
    });

    res.json(order);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating order");
  }
});

// Start server
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
