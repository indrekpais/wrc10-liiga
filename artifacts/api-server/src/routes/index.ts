import { Router, type IRouter } from "express";
import healthRouter from "./health";
import appdataRouter from "./appdata";
import calendarRouter from "./calendar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(appdataRouter);
router.use(calendarRouter);

export default router;
