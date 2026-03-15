import express from "express";
import {
  getAvailableNumbers,
  activateNumber,
  updateCallForwarding,
} from "../controllers/virtualNumberProxy.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/available", authMiddleware, getAvailableNumbers);
router.post("/activate", authMiddleware, activateNumber);
router.put("/call-forward", authMiddleware, updateCallForwarding);

export default router;
