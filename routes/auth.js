const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth, requireAdmin, requireSuperAdmin } = require('../middleware/auth');

// Register - Admin/Business Owner
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, businessName, gstNumber, address, state, phone } = req.body;

    if (!email || !password || !name || !businessName || !gstNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user (password will be hashed by pre-save hook)
    const user = await User.create({
      email,
      password,
      name,
      userType: 'admin',
      businessName,
      gstNumber,
      address,
      state,
      phone
    });

    // Create session
    req.session.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      userType: user.userType,
      businessId: user._id.toString()
    };

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        businessName: user.businessName
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Register - Customer
router.post('/register/customer', async (req, res) => {
  try {
    const { email, password, name, phone, companyName, gstin, address, state, pincode } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = await User.create({
      email,
      password,
      name,
      userType: 'customer',
      phone,
      companyName,
      gstin,
      address,
      state,
      pincode
    });

    req.session.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      userType: user.userType
    };

    res.status(201).json({
      message: 'Customer registration successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType
      }
    });
  } catch (error) {
    console.error('Customer registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    req.session.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      userType: user.userType,
      businessId: user.userType === 'admin' ? user._id.toString() : (user.businessId ? user.businessId.toString() : null)
    };

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        businessName: user.businessName
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      businessName: user.businessName,
      businessId: user.businessId
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;

