import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workspacesRouter from "./workspaces";
import subscriptionRouter from "./subscription";
import webhookRouter from "./webhook";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workspacesRouter);
router.use(subscriptionRouter);
router.use(webhookRouter);

export default router;
