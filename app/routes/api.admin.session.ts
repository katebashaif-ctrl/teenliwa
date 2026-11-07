import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { handleAdminSessionAction, handleAdminSessionLoader } from "../backend/endpoints/adminSessionEndpoint";
export async function loader(args: LoaderFunctionArgs) { return handleAdminSessionLoader(args); }
export async function action(args: ActionFunctionArgs) { return handleAdminSessionAction(args); }
