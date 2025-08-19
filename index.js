const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config(); // load env variables

const { router: authRouter } = require("./auth"); //import auth routes

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;

// -------------------
// Connect to MongoDB
// -------------------
const connectDB = async () => {
  try {
    const MONGOURI = process.env.MONGO_URL;
    if (!MONGOURI) {
      throw new Error("MONGO_URL not set in environment variables");
    }

    await mongoose.connect(MONGOURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ Unable to connect to database:", error.message);
    process.exit(1); // exit if DB connection fails
  }
};

// -------------------
// Mount Routes
// -------------------
app.use("/", authRouter);

// -------------------
// Product Schema
// -------------------
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    category: { type: String },
    stock: { type: Number, default: 0 },
    images: [String], // image URLs
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

// -------------------
// Product Routes
// -------------------

// Get all products
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json({ products });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get product by ID
app.get("/product/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ product });
  } catch (error) {
    console.error("Error fetching product:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------
// Order Schema
// -------------------
const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // not required to avoid crash
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
      },
    ],
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

// -------------------
// Start Server
// -------------------
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

// -------------------
// Exports
// -------------------
module.exports = { Product, Order };
