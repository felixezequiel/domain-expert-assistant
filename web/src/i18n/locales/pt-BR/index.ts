import common from "./common.json";
import nav from "./nav.json";
import auth from "./auth.json";
import dashboard from "./dashboard.json";
import knowledge from "./knowledge.json";
import review from "./review.json";
import audit from "./audit.json";
import consumer from "./consumer.json";
import admin from "./admin.json";
import errors from "./errors.json";

// Single `translation` namespace, grouped by area. Each section is its own JSON file so the
// translation work parallelises without file conflicts. Keys are dotted: t("nav.links.home").
export const ptBR = {
  common,
  nav,
  auth,
  dashboard,
  knowledge,
  review,
  audit,
  consumer,
  admin,
  errors,
};
