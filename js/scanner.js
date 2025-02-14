import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// 🔹 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCd5lYY7EAkxYzV_lbolu7KFx8nTEHiLug",
  authDomain: "ticket-scanner-2b7f1.firebaseapp.com",
  projectId: "ticket-scanner-2b7f1",
  storageBucket: "ticket-scanner-2b7f1.firebasestorage.app",
  messagingSenderId: "431290258037",
  appId: "1:431290258037:web:73fa6d44e5335c37989e3c",
};

// 🔹 Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🎵 Load Sound Effects
const soundSuccess = new Audio("sounds/success.mp3"); // ✅ Green
const soundError = new Audio("sounds/error.mp3"); // ❌ Red
const soundVIP = new Audio("sounds/vip.mp3"); // 🎉 Gold

let debounceTimeout; // Variable to store the timeout ID

document
  .getElementById("barcodeInput")
  .addEventListener("input", async function (event) {
    let barcode = event.target.value.trim().toLowerCase(); // Trim and convert to lowercase
    if (!barcode) return;

    console.log(`🔍 Scanning barcode: ${barcode}`);

    // Clear the previous timeout to reset the debouncing delay
    clearTimeout(debounceTimeout);

    // Set a new timeout to wait 300ms after the last character is entered
    debounceTimeout = setTimeout(async () => {
      let eventID = localStorage.getItem("eventID");
      if (!eventID) {
        showFeedback("⚠️ No Event Found. Upload first.", "red", soundError);
        return;
      }

      try {
        let ticketsRef = collection(db, eventID);
        let q = query(ticketsRef, where("barcode", "==", barcode));
        let querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          showFeedback("❌ Ticket Not Found!", "red", soundError);
        } else {
          querySnapshot.forEach(async (docSnap) => {
            let ticketData = docSnap.data();

            let ticketRef = doc(db, eventID, docSnap.id);

            if (ticketData.checkedIn) {
              showFeedback("⚠️ Ticket already checked in!", "red", soundError);
            } else {
              await updateDoc(ticketRef, { checkedIn: true });

              let message = `✅ Welcome, ${ticketData.name}!`;
              let color = "green";
              let sound = soundSuccess;

              if (ticketData.vipGuest === "Yes") {
                message += " 🎉 VIP Access";
                color = "gold";
                sound = soundVIP;
              }

              showFeedback(message, color, sound);
            }
          });
        }
      } catch (error) {
        console.error("❌ Error scanning ticket:", error);
        showFeedback("⚠️ Error scanning ticket.", "red", soundError);
      }

      event.target.value = ""; // Clear input field after scan
    }, 100); // 300ms delay
  });

// 🔹 Function to Show Feedback (Flash Screen + Sound)
function showFeedback(message, color, sound) {
  const scanStatus = document.getElementById("scanStatus");
  const body = document.body;

  scanStatus.innerText = message;
  body.classList.add(`flash-${color}`);
  sound.play();

  setTimeout(() => {
    body.classList.remove(`flash-${color}`);
  }, 500);
}
