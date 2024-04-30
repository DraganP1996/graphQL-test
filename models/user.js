const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Types = mongoose.Types;

const userchema = new Schema(
  {
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: 'I am new!',
    },
    posts: [
      {
        type: Types.ObjectId,
        ref: "Post",
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userchema);
