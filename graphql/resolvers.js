const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Post = require("../models/post");
const { clearImage } = require("../utils/file");

module.exports = {
  createUser: async function ({ userInput }, req) {
    const { email, name, password } = userInput;
    const errors = [];
    if (!validator.isEmail(email)) {
      errors.push({ message: "E-mail is invalid." });
    }

    if (
      !validator.isLength(password, { min: 5 }) ||
      validator.isEmpty(password)
    ) {
      errors.push({ message: "Password too short" });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input");

      error.data = error;
      error.code = 422;

      throw error;
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      const error = new Error("User exists already");

      throw error;
    }

    const hashPsw = await bcrypt.hash(password, 12);
    const user = new User({
      email,
      name,
      password: hashPsw,
    });

    const createdUser = await user.save();

    return { ...createdUser._doc, _id: createdUser._id.toString() };
  },

  login: async function ({ email, password }) {
    const user = await User.findOne({ email });

    if (!user) {
      const error = new Error("User not found");

      error.code = 401;
      throw error;
    }

    const isValidPsw = await bcrypt.compare(password, user.password);

    if (!isValidPsw) {
      const error = new Error("Password is incorrect");

      error.code = 401;
      throw error;
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      "somesupersecretsecrettoken",
      { expiresIn: "1h" }
    );

    return {
      userId: user._id.toString(),
      token,
    };
  },

  createPost: async function ({ postInput }, req) {
    const errors = [];
    const { title, content, imageUrl } = postInput;

    if (!req.isAuth) {
      const error = new Error("Not authenticated");

      error.code = 401;
      throw error;
    }

    if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
      errors.push({
        message: "Title is invalid",
      });
    }

    if (
      validator.isEmpty(content) ||
      !validator.isLength(content, { min: 5 })
    ) {
      errors.push({
        message: "Content is invalid",
      });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input");

      error.data = error;
      error.code = 422;

      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("User not found");

      error.data = error;
      error.code = 401;

      throw error;
    }

    const post = await new Post({
      title,
      content,
      imageUrl,
      creator: user,
    }).save();

    user.posts.push(post);
    await user.save();

    // Add post to user posts
    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },

  posts: async function ({ page }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");

      error.code = 401;
      throw error;
    }

    if (!page) {
      page = 1;
    }

    const PER_PAGE = 2;
    const total = await Post.countDocuments();
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * PER_PAGE)
      .limit(PER_PAGE)
      .populate("creator");

    return {
      posts: posts.map((p) => ({
        ...p._doc,
        _id: p._id.toString(),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      total,
    };
  },

  post: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");

      error.code = 401;
      throw error;
    }

    if (id == undefined) {
      const error = new Error("Id not provided.");

      throw error;
    }

    const post = await Post.findById(id).populate("creator");

    if (!post) {
      const error = new Error("No post found");

      error.code = 404;
      throw error;
    }

    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },

  updatePost: async function ({ id, postInput }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");

      error.code = 401;
      throw error;
    }

    if (id == undefined) {
      const error = new Error("Id not provided.");

      throw error;
    }

    const post = await Post.findById(id).populate("creator");

    if (!post) {
      const error = new Error("No post found");

      error.code = 404;
      throw error;
    }

    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error("Not authorized to edit this post");

      error.code = 403;
      throw error;
    }

    const errors = [];
    const { title, content, imageUrl } = postInput;

    if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
      errors.push({
        message: "Title is invalid",
      });
    }

    if (
      validator.isEmpty(content) ||
      !validator.isLength(content, { min: 5 })
    ) {
      errors.push({
        message: "Content is invalid",
      });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input");

      error.data = error;
      error.code = 422;

      throw error;
    }

    post.title = title;
    post.content = content;

    if (imageUrl !== "undefined") {
      post.imageUrl = imageUrl;
    }

    const updatedPost = await post.save();

    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },

  deletePost: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");

      error.code = 401;
      throw error;
    }

    if (id == undefined) {
      const error = new Error("Id not provided.");

      throw error;
    }

    const post = await Post.findById(id);

    if (!post) {
      const error = new Error("No post found");

      error.code = 404;
      throw error;
    }

    if (post.creator.toString() !== req.userId.toString()) {
      const error = new Error("Not authorized to edit this post");

      error.code = 403;
      throw error;
    }

    clearImage(post.imageUrl);
    await Post.findByIdAndDelete(id);

    const user = await User.findById(req.userId);

    user.posts.pull(id);
    await user.save();

    return true;
  },

  user: async function (args, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");

      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("No user found");

      error.code = 404;
      throw error;
    }

    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },

  updateStatus: async function ({ status }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");

      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("No user found");

      error.code = 404;
      throw error;
    }

    user.status = status;
    await user.save();

    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },
};
