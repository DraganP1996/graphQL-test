const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const errorFn = require("../utils/catch-error");

const User = require("../models/user");

exports.signup = async (req, res, next) => {
  try {
    console.log("SINGUP START");

    const errors = validationResult(req);

    console.log("VALIDATON ERRORS", errors);

    if (!errors.isEmpty()) {
      const error = new Error("Validation failed.");

      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const { name, email, password } = req.body;
    const hashedPsw = await bcrypt.hash(password, 12);
    const user = new User({
      email,
      name,
      password: hashedPsw,
    });
    const result = await user.save();

    res.status(201).json({
      message: "User created.",
      userId: result._id,
    });
  } catch (err) {
    errorFn(next, err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      const error = new Error("Email not exists");

      error.statusCode = 401;
      error.data = user;
      throw error;
    }

    const isPswValid = await bcrypt.compare(password, user.password);

    console.log(isPswValid);

    if (!isPswValid) {
      const error = new Error("Wrong password");

      error.statusCode = 401;
      error.data = user;
      throw error;
    }

    const token = jwt.sign(
      {
        email: user.email,
        userId: user._id.toString(),
      },
      "secret",
      { expiresIn: "1h" }
    );

    res.status(200).json({
      token,
      userId: user._id.toString(),
    });
  } catch (err) {
    errorFn(next, err);
  }
};

exports.getStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    res.status(200).json({
      status: user.status,
    });
  } catch (err) {
    errorFn(next, err);
  }
};

exports.postStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const status = req.body.status;
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error("User not found.");

      error.statusCode = 404;
      throw error;
    }

    user.status = status;
    await user.save();

    res.status(200).json({
      message: "Status changed",
    });
  } catch (err) {}
};
