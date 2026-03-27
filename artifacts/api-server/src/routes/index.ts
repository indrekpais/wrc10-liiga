import { Router, type IRouter } from "express";
import healthRouter from "./health";
import appdataRouter from "./appdata";

const router: IRouter = Router();

router.use(healthRouter);
router.use(appdataRouter);

export default router;
