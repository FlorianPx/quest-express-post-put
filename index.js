require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { check, validationResult } = require("express-validator");
const connection = require("./db");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/api/users", (req, res) => {
  connection.query("SELECT * FROM user", (err, results) => {
    if (err) {
      res.status(500).json({
        error: err.message,
        sql: err.sql,
      });
    } else {
      res.json(results);
    }
  });
});

const userValidationMiddlewares = [
  // email must be valid
  check("email").isEmail(),
  // password must be at least 8 chars long
  check("password").isLength({ min: 8 }),
  // let's assume a name should be 2 chars long
  check("name").isLength({ min: 2 }),
];

app.post("/api/users", userValidationMiddlewares, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  return connection.query(
    "INSERT INTO user SET ?",
    req.body,
    (err, results) => {
      if (err) {
        if (err === "ER_DUP_ENTRY") {
          return res.status(409).json({ error: "Email already exists" });
        }
        return res.status(500).json({
          error: err.message,
          sql: err.sql,
        });
      }
      return connection.query(
        "SELECT * FROM user WHERE id = ?",
        results.insertId,
        (err2, records) => {
          if (err2) {
            return res.status(500).json({
              error: err2.message,
              sql: err2.sql,
            });
          }
          const insertedUser = records[0];
          const { password, ...user } = insertedUser;
          const host = req.get("host");
          const location = `http://${host}${req.url}/${user.id}`;
          return res.status(201).set("Location", location).json(user);
        }
      );
    }
  );
});

app.put("/api/users/:id", userValidationMiddlewares, (req, res) => {
  const errors = validationResult(req);
  const userId = req.params.id;
  const userBody = req.body;

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  return connection.query(
    "UPDATE user SET ? WHERE id = ?",
    [userBody, userId],
    (err, results) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            error: "Email already exists",
          });
        }
        return res.status(500).json({
          error: err.message,
          sql: err.sql,
        });
      }
      return connection.query(
        "SELECT * FROM user WHERE id = ?",
        userId,
        (err2, records) => {
          if (err2) {
            return res.status(500).json({
              error: err2.message,
              sql: err2.sql,
            });
          }
          const userId = records[0];
          const { password, ...user } = userId;
          const host = req.get("host");
          const location = `http://${host}${req.url}/${user.id}`;
          return res.status(200).set("Location", location).json(user);
        }
      );
    }
  );
});

app.get(
  "/superMiddleware",
  (req, res, next) => {
    if (req) {
      console.log("Hello middleware");
      return next();
    } else {
      return res.redirect("/");
    }
  },
  (req, res, next) => {
    res.send("Hello world");
  }
);

app.listen(process.env.PORT, (err) => {
  if (err) {
    throw new Error("Something bad happened...");
  }

  console.log(`Server is listening on ${process.env.PORT}`);
});
