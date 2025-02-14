import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// 🔹 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCd5lYY7EAkxYzV_lbolu7KFx8nTEHiLug",
  authDomain: "ticket-scanner-2b7f1.firebaseapp.com",
  projectId: "ticket-scanner-2b7f1",
  storageBucket: "ticket-scanner-2b7f1.appspot.com",
  messagingSenderId: "431290258037",
  appId: "1:431290258037:web:73fa6d44e5335c37989e3c",
};

// 🔹 Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document
  .getElementById("uploadBtn")
  .addEventListener("click", async function () {
    const fileInput = document.getElementById("fileInput");
    const eventName = document.getElementById("eventName").value.trim();
    const eventDate = document.getElementById("eventDate").value.trim();

    if (!fileInput.files.length || !eventName || !eventDate) {
      alert("Please select a file and enter event details.");
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
      const csvData = e.target.result;
      let rows = csvData.split("\n").map((row) => row.split(","));

      if (rows.length < 4) {
        console.error("⚠️ CSV file is missing required columns.");
        return;
      }

      // 🔹 Create a unique event ID
      let eventID = `${eventName.replace(/\s+/g, "_")}_${eventDate}`;
      console.log(`📂 Event ID: ${eventID}`);

      // 🔹 Store event ID globally in Firestore
      const globalRef = doc(db, "GlobalSettings", "CurrentEvent");
      await setDoc(globalRef, { eventID });

      // 🔹 Skip the first 3 rows of headers
      rows.splice(0, 3);

      let batchPromises = [];
      for (let row of rows) {
        if (row.length >= 12) {
          let name = row[3].replace(/['"]/g, "").trim();
          let confirmation = row[8].replace(/['"]/g, "").trim();
          let rowNumber = row[10].replace(/['"]/g, "").trim();
          let seatNumber = row[11].replace(/['"]/g, "").trim();
          let barcode = row[2].replace(/['"]/g, "").trim();
          let isVIP = row[5].toLowerCase().includes("vip") ? "Yes" : "No";

          let ticketData = {
            name,
            rowNumber,
            seatNumber,
            vipGuest: isVIP,
            checkedIn: false,
            barcode,
          };

          // 🔹 Upload each ticket as a Firestore document
          let docRef = doc(collection(db, eventID), confirmation);
          batchPromises.push(setDoc(docRef, ticketData));
        }
      }

      // 🔹 Upload all documents
      try {
        await Promise.all(batchPromises);
        document.getElementById("statusMessage").innerText =
          "✅ Upload successful!";
        console.log("✅ Upload successful!");
      } catch (error) {
        console.error("❌ Error uploading file:", error);
        document.getElementById("statusMessage").innerText =
          "❌ Error uploading file.";
      }
    };

    reader.readAsText(file);
  });
