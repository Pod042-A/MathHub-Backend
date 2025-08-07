import express, { type Router } from "express";
import { ROUTER as NoticeboardRouter } from "./admin/Noticeboard.js";

const ROUTER: Router = express.Router();

ROUTER.use("/noticeboard", NoticeboardRouter);

export { ROUTER };
