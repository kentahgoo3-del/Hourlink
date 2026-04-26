import { router } from "expo-router";

type RoutePath = string;

export function navigate(path: RoutePath): void {
  (router.push as (path: RoutePath) => void)(path);
}
