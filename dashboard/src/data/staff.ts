import "server-only";
import { selectSource } from "@/data/select-source";
import type { StaffSource } from "@/domain/staff/source";
import { staffDb } from "@/data/staff.db";
import { staffMock } from "@/data/staff.mock";

/* FAÇADE du personnel : seul module importé par le front ; DATA_SOURCE choisit fixtures ou Postgres. */
const source: StaffSource = selectSource("personnel", staffMock, staffDb);

export const listStaff: StaffSource["listStaff"] = (kind) =>
  source.listStaff(kind);
export const getStaff: StaffSource["getStaff"] = (id) => source.getStaff(id);
export const createStaff: StaffSource["createStaff"] = (input) =>
  source.createStaff(input);
export const updateStaff: StaffSource["updateStaff"] = (id, input) =>
  source.updateStaff(id, input);
export const deleteStaff: StaffSource["deleteStaff"] = (id) =>
  source.deleteStaff(id);
