/**
 * Data model for the decision-tree editor.
 *
 * Only squares (TreeNode) and arrows (TreeEdge) carry meaning for the backend.
 * Everything else (links, roles, depth, counts) is DERIVED from these two tables
 * and never stored, so there is one source of truth.
 *
 * Fields marked "later" exist so the local single-user build already writes data
 * the multiplayer + auth build can read without a migration.
 */

export type TreeId = string;
export type NodeId = string;
export type EdgeId = string;
export type UserId = string;

/** A square on the canvas. */
export interface TreeNode {
  id: NodeId;
  treeId: TreeId;
  /** Raw text as typed. Links are detected from this at read time. */
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Exactly one node per tree. Holds the top-level question. Cannot be deleted. */
  isRoot: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  createdBy?: UserId; // later
  updatedBy?: UserId; // later
}

/** An arrow from a parent square to a child square. */
export interface TreeEdge {
  id: EdgeId;
  treeId: TreeId;
  source: NodeId; // parent
  target: NodeId; // child
  /** Optional text label on the arrow, e.g. "Yes" / "No". Not used to compute the tree. */
  label?: string;
  createdAt: string;
  createdBy?: UserId; // later
}

/** One canvas. Later: one tab. */
export interface Tree {
  id: TreeId;
  name: string;
  rootNodeId: NodeId;
  createdAt: string;
  updatedAt: string;
}

/** Full persisted document for one tree. */
export interface TreeDocument {
  version: 1;
  tree: Tree;
  nodes: TreeNode[];
  edges: TreeEdge[];
}

/* ---------- derived, never stored ---------- */

export interface LinkRef {
  url: string;
  /** character offsets in TreeNode.text */
  start: number;
  end: number;
}

export type NodeRole = "question" | "answer" | "source";

export interface DerivedNode {
  node: TreeNode;
  depth: number;
  parentIds: NodeId[];
  childIds: NodeId[];
  links: LinkRef[];
  role: NodeRole;
  /** Path number like "1", "1.2", "1.2.3" for display in the panel. */
  number: string;
}

/* ---------- later: multiplayer + auth (not used in this iteration) ---------- */

export interface User {
  id: UserId;
  firstName: string;
  lastName: string;
  email: string;
  color: string;
  createdAt: string;
}

/** Soft lock on one square while a user types in it. */
export interface NodeLock {
  nodeId: NodeId;
  userId: UserId;
  userName: string;
  lockedAt: string;
  /** Refreshed on every keystroke. Lock expires 5 minutes after this. */
  lastActivityAt: string;
}

export const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export interface Presence {
  userId: UserId;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null; // canvas coordinates
  editingNodeId: NodeId | null;
}

/** One shared workspace behind one password. Later. */
export interface Workspace {
  id: string;
  name: string;
  passwordHash: string;
  treeIds: TreeId[];
}
