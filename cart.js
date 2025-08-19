// backend/routes/cart.js
const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();

// ========== CART SCHEMA ==========
const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // guest carts allowed
    },
    items: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        image: { type: String },
        quantity: { type: Number, required: true, default: 1, min: 1 },
      },
    ],
    totalPrice: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "ordered", "abandoned"],
      default: "active",
    },
    sessionId: { type: String }, // for guest carts
  },
  { timestamps: true }
);

// Auto calculate total before saving
cartSchema.pre("save", function (next) {
  this.totalPrice = this.items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  next();
});

const Cart = mongoose.model("Cart", cartSchema);

// ========== ROUTES ==========

// Add item to cart
router.post("/cart/add", async (req, res) => {
  try {
    const { user, sessionId, name, price, image, quantity = 1 } = req.body;
    if (!name || !price) {
      return res
        .status(400)
        .json({ success: false, message: "Name and price are required" });
    }

    let cart = user
      ? await Cart.findOne({ user, status: "active" })
      : await Cart.findOne({ sessionId, status: "active" });

    if (!cart) {
      cart = new Cart({ user, sessionId, items: [], status: "active" });
    }

    const existingIndex = cart.items.findIndex((item) => item.name === name);
    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += parseInt(quantity);
    } else {
      cart.items.push({ name, price, image, quantity: parseInt(quantity) });
    }

    await cart.save();
    res.status(201).json({ success: true, message: "Item added", data: cart });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to add item",
        error: error.message,
      });
  }
});

// Get cart
router.get("/cart", async (req, res) => {
  try {
    const { user, sessionId } = req.query;
    let cart = user
      ? await Cart.findOne({ user, status: "active" })
      : await Cart.findOne({ sessionId, status: "active" });

    res
      .status(200)
      .json({ success: true, data: cart || { items: [], totalPrice: 0 } });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch cart",
        error: error.message,
      });
  }
});

// Update quantity
router.put("/cart/update", async (req, res) => {
  try {
    const { user, sessionId, name, quantity } = req.body;
    let cart = user
      ? await Cart.findOne({ user, status: "active" })
      : await Cart.findOne({ sessionId, status: "active" });

    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });

    const item = cart.items.find((item) => item.name === name);
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Item not found in cart" });

    item.quantity = parseInt(quantity);
    await cart.save();

    res
      .status(200)
      .json({ success: true, message: "Quantity updated", data: cart });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to update item",
        error: error.message,
      });
  }
});

// Remove item
router.delete("/cart/remove", async (req, res) => {
  try {
    const { user, sessionId, name } = req.body;
    let cart = user
      ? await Cart.findOne({ user, status: "active" })
      : await Cart.findOne({ sessionId, status: "active" });

    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });

    cart.items = cart.items.filter((item) => item.name !== name);
    await cart.save();

    res
      .status(200)
      .json({ success: true, message: "Item removed", data: cart });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to remove item",
        error: error.message,
      });
  }
});

// Clear cart
router.delete("/cart/clear", async (req, res) => {
  try {
    const { user, sessionId } = req.body;
    let cart = user
      ? await Cart.findOne({ user, status: "active" })
      : await Cart.findOne({ sessionId, status: "active" });

    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });

    cart.items = [];
    await cart.save();

    res
      .status(200)
      .json({ success: true, message: "Cart cleared", data: cart });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to clear cart",
        error: error.message,
      });
  }
});

// Merge guest cart into user cart on login
router.post("/cart/merge", async (req, res) => {
  try {
    const { user, sessionId } = req.body;
    if (!user || !sessionId) {
      return res
        .status(400)
        .json({ success: false, message: "User and sessionId required" });
    }

    let guestCart = await Cart.findOne({ sessionId, status: "active" });
    let userCart = await Cart.findOne({ user, status: "active" });

    if (!guestCart)
      return res.status(200).json({ success: true, message: "No guest cart" });

    if (!userCart) {
      guestCart.user = user;
      guestCart.sessionId = null;
      await guestCart.save();
      return res
        .status(200)
        .json({ success: true, message: "Cart merged", data: guestCart });
    }

    // Merge items
    guestCart.items.forEach((gItem) => {
      const uItem = userCart.items.find((item) => item.name === gItem.name);
      if (uItem) {
        uItem.quantity += gItem.quantity;
      } else {
        userCart.items.push(gItem);
      }
    });

    await userCart.save();
    await Cart.deleteOne({ _id: guestCart._id });

    res
      .status(200)
      .json({ success: true, message: "Carts merged", data: userCart });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to merge cart",
        error: error.message,
      });
  }
});

// Checkout
router.post("/cart/checkout", async (req, res) => {
  try {
    const { user, sessionId } = req.body;
    let cart = user
      ? await Cart.findOne({ user, status: "active" })
      : await Cart.findOne({ sessionId, status: "active" });

    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });

    cart.status = "ordered";
    await cart.save();

    res
      .status(200)
      .json({ success: true, message: "Checkout complete", data: cart });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Checkout failed",
        error: error.message,
      });
  }
});

module.exports = router;
