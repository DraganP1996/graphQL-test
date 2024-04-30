const path = require("path");
const fs = require("fs");
const https = require('https');

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { graphqlHTTP } = require("express-graphql");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");

console.log(process.env.NODE_ENV);

const MONGODB_CONNECTION_STRING = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.wcae0cc.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}?w=majority&appName=Cluster0`;

const authMiddleware = require("./middleware/auth");
const { clearImage } = require("./utils/file");

const privateKey = fs.readFileSync('server.key');
const certificate = fs.readFileSync('server.cert');

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "images"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image.jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, "access.log"),
  { flags: "a" }
);

// Middleware that is used in order to statically provide the assets
app.use("/images", express.static(path.join(__dirname, "images")));
// Middleware that is parsing the incoming JSON data.
app.use(express.json());
app.use(multer({ storage: fileStorage, fileFilter }).single("image"));

app.use(helmet());
app.use(compression());
app.use(morgan("combined", { stream: accessLogStream }));

// Setting CORS and other headers
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// error middleware
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message;
  const data = err.data;

  res.status(status).json({ message, data });
});

app.use(authMiddleware);

app.put("/post-image", (req, res, next) => {
  if (!req.isAuth) {
    throw new Error("Not authenticated !");
  }

  if (!req.file) {
    return res.status(200).json({ message: "No file provided." });
  }

  if (req.baseUrl.oldPath) {
    clearImage(req.body.oldPath);
  }

  return res
    .status(201)
    .json({ message: "File stored", filePath: req.file.path });
});

app.use(
  "/graphql",
  graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
  })
);

// Google about top-level await - it is not really clear and I'm not able
// to put an await here for that.
mongoose
  .connect(MONGODB_CONNECTION_STRING)
  .then(() => {
    app.listen(process.env.PORT || 3000);
    console.log(process.env.PORT || 3000);
  })
  .catch((err) => console.log(err));
