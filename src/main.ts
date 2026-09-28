import { Application } from "./application.ts";

const workbookForm = document.querySelector<HTMLFormElement>("#workbook-form")!;

new Application(workbookForm);
