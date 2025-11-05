"use strict";

import { auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from './firebase-init.js';

const loginForm = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const errorMessage = document.getElementById("error-message");

onAuthStateChanged(auth, user => {
  if (user) {
    window.location.href = "index.html";
  }
});

loginForm.addEventListener("submit", e => e.preventDefault());

loginBtn.addEventListener("click", () => {
  const email = loginForm.email.value;
  const password = loginForm.password.value;

  signInWithEmailAndPassword(auth, email, password)
    .catch(error => {
      errorMessage.textContent = error.message;
      errorMessage.style.display = "block";
    });
});

signupBtn.addEventListener("click", () => {
  const email = loginForm.email.value;
  const password = loginForm.password.value;

  createUserWithEmailAndPassword(auth, email, password)
    .catch(error => {
      errorMessage.textContent = error.message;
      errorMessage.style.display = "block";
    });
});
