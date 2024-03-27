const express = require("express");
const router = express.Router();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User.model");

const { isAuthenticated } = require("../middleware/auth.middleware.js");
const cleanString = require("../utils/cleanString.js")

const saltRounds = 10;

// POST /api/auth/signup - Validates user data and creates user document in the DB
router.post("/signup", async (req, res, next) => {
  const { email, password, firstName, lastName, phoneCode, phoneNumber } = req.body;
  console.log(email, password, firstName, lastName, phoneCode, phoneNumber)

  if (!email || !password || !firstName || !lastName || !phoneCode || !phoneNumber) {
    res.status(400).json({ errorMessage: "Todos los campos deben estar llenos" });
    return;
  }

  const nameRegex = /^[a-zA-ZÀ-ÖØ-öØ-ÿ\s']{1,20}$/;
  if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
    res.status(400).json({ errorMessage: "Campos de nombre y apellido deben tener solo letras, espacios y de 2 a 20 caracteres" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ errorMessage: "Correo electrónico con formato incorrecto" });
    return;
  }

  const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;
  if (!passwordRegex.test(password)) {
    res.status(400).json({ errorMessage: "Contraseña debe tener al menos 6 caractéres, un numero, una minúscula y una mayúscula" });
    return;
  }

  const phoneNumberRegex = /^[0-9]{4,20}$/;
  if (!phoneNumberRegex.test(phoneNumber)) {
    res.status(400).json({ errorMessage: "Número telefónico solo debe contener dígitos numericos y de 4 a 20 dígitos" });
    return;
  }

  try {

    const foundUserByEmail = await User.findOne({ email });
    if (foundUserByEmail) {
      res.status(400).json({ errorField: "email", errorMessage: "Ya existe un usuario con ese correo electronico" });
      return;
    }

    const foundUserByFullName = await User.findOne({ $and: [{firstName: cleanString(firstName)}, {lastName: cleanString(lastName)}]});
    if (foundUserByFullName) {
      res.status(400).json({ errorField: "fullName", errorMessage: "Ya existe un usuario con el mismo nombre y apellido" });
      return;
    }

    const foundUserByPhoneNumber = await User.findOne({ $and: [{phoneCode}, {phoneNumber}]});
    if (foundUserByPhoneNumber) {
      res.status(400).json({ errorField: "phoneNumber", errorMessage: "Ya existe un usuario con ese número telefonico" });
      return;
    }

    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);

    await User.create({ 
      email, 
      firstName: cleanString(firstName), // removes double spaces and converts to lowercase
      lastName: cleanString(lastName), // removes double spaces and converts to lowercase
      phoneCode, 
      phoneNumber, 
      password: hashedPassword 
    });

    res.sendStatus(201);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login - Authenticates user credentials (email/username and password) and returns a JWT
router.post("/login", async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ errorMessage: "Todos los campos deben estar llenos" });
    return;
  }
  
  try {
    
    const foundUser = await User.findOne({ email })

    if (!foundUser) {
      res.status(401).json({ errorField: "email", errorMessage: "Usuario no encontrado con ese correo electrónico" });
      return;
    }

    const passwordCorrect = await bcrypt.compare(password, foundUser.password);
    if (!passwordCorrect) {
      res.status(401).json({ errorField: "password", errorMessage: "Contraseña no valida" });
      return;
    }

    if (foundUser.role === "pending") {
      res.status(401).json({ errorField: "role", errorMessage: "Usuario sin permisos para entrar a la app, contacte a un admin para solicitar permiso" });
      return;
    }

    const payload = { 
      _id: foundUser._id, 
      email: foundUser.email, 
      role: foundUser.role 
    };

    const authToken = jwt.sign(payload, process.env.TOKEN_SECRET, {
      algorithm: "HS256",
      expiresIn: "7w",
    });

    res.status(200).json({ authToken: authToken });

  } catch (error) {
    next(error)
  }

});

// GET /api/auth/verify - Used to verify JWT stored on the client
router.get("/verify", isAuthenticated, (req, res, next) => {
  res.status(200).json({payload: req.payload});
});

module.exports = router;