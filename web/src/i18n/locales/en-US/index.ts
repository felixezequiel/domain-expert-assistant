import common from "./common.json";
import nav from "./nav.json";
import auth from "./auth.json";
import dashboard from "./dashboard.json";
import knowledge from "./knowledge.json";
import review from "./review.json";
import audit from "./audit.json";
import consumer from "./consumer.json";
import admin from "./admin.json";

// en-US values are the verbatim original UI copy, so component tests (pinned to en-US) keep
// asserting the same strings. Keys mirror pt-BR. Dotted keys: t("nav.links.home").
export const enUS = {
  common,
  nav,
  auth,
  dashboard,
  knowledge,
  review,
  audit,
  consumer,
  admin,
};
