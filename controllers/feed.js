const fs = require("fs");
const path = require("path");

const { validationResult } = require("express-validator");

const IO = require("../socket");
const Post = require("../models/post");
const User = require("../models/user");

const errorFn = require("../utils/catch-error");

exports.getPosts = async (req, res, next) => {
  try {
    const currentPage = req.query.page || 1;
    const PER_PAGE = 2;
    const totalItems = await Post.countDocuments();
    const posts = await Post.find()
      .populate("creator")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * PER_PAGE)
      .limit(PER_PAGE);

    res.status(200).json({
      message: "Fetched posts successfully.",
      posts,
      totalItems,
    });
  } catch (err) {
    errorFn(next, err);
  }
};

exports.createPost = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const err = new Error("Validation failed.");

      err.statusCode = 422;
      throw err;
    }

    if (!req.file) {
      const error = new Error("No image provided");

      error.statusCode = 422;
      throw error;
    }

    const imageUrl = req.file.path;
    const { title, content } = req.body;
    const post = new Post({
      title,
      content,
      imageUrl,
      creator: req.userId,
    });

    await post.save();
    const user = await User.findById(req.userId);
    const { _id, name } = user;

    user.posts.push(post);
    await user.save();

    const io = IO.getIO();

    io.emit("posts", {
      action: "create",
      post,
    });

    //Creat post in db
    res.status(201).json({
      message: "Post created.",
      post: post,
      creator: { _id, name },
    });
  } catch (err) {
    errorFn(next, err);
  }
};

exports.getPost = async (req, res, next) => {
  try {
    const postId = req.params.postId;
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error("No post found");

      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: "Post fetched",
      post,
    });
  } catch (err) {
    errorFn(next, err);
  }
};

exports.editPost = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const err = new Error("Validation failed.");

      err.statusCode = 422;
      throw err;
    }

    const postId = req.params.postId;
    const { title, content } = req.body;
    const imageUrl = !!req.file ? req.file.path : req.body.image;

    if (!imageUrl) {
      const error = new Error("No image provided");

      error.statusCode = 422;
      throw error;
    }

    const post = await Post.findById(postId).populate("creator");

    if (!post) {
      const error = new Error("No post found for id" + postId);

      error.statusCode = 404;
      throw error;
    }

    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("Not authorized");

      error.statusCode = 403;
      throw error;
    }

    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }

    post.title = title;
    post.content = content;
    post.imageUrl = imageUrl;

    const result = await post.save();

    IO.getIO.emit("posts", { action: "update", post: result });

    res.status(200).json({
      message: "Post updated",
      post: result,
    });
  } catch (err) {
    errorFn(next, err);
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    const postId = req.params.postId;
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error("No post found for id" + postId);

      error.statusCode = 404;
      throw error;
    }

    if (post.creator.toString() !== req.userId) {
      const error = new Error("Not authorized");

      error.statusCode = 403;
      throw error;
    }

    clearImage(post.imageUrl);

    await Post.findByIdAndDelete(postId);

    const user = await User.findById(req.userId);

    user.posts.pull(postId);
    await user.save();

    IO.getIO().emit("posts", {
      action: "delete",
      post: postId,
    });

    res.status(200).json({ message: "Deleted post." });
  } catch (err) {
    errorFn(next, err);
  }
};

const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => console.log(err));
};
