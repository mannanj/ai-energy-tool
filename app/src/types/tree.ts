export type TreeId = string;
export type NodeId = string;
export type EdgeId = string;
export type UserId = string;

export interface TreeNode {
  id: NodeId;
  treeId: TreeId;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isRoot: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: UserId;
  updatedBy?: UserId;
}

export interface TreeEdge {
  id: EdgeId;
  treeId: TreeId;
  source: NodeId;
  target: NodeId;
  label?: string;
  createdAt: string;
  createdBy?: UserId;
}

export interface Tree {
  id: TreeId;
  name: string;
  rootNodeId: NodeId;
  createdAt: string;
  updatedAt: string;
}

export interface TreeDocument {
  version: 1;
  tree: Tree;
  nodes: TreeNode[];
  edges: TreeEdge[];
}

export interface LinkRef {
  url: string;
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
  number: string;
}

export interface User {
  id: UserId;
  firstName: string;
  lastName: string;
  email: string;
  color: string;
  createdAt: string;
}

export interface NodeLock {
  nodeId: NodeId;
  userId: UserId;
  userName: string;
  lockedAt: string;
  lastActivityAt: string;
}

export const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export interface Presence {
  userId: UserId;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  editingNodeId: NodeId | null;
}

export interface Workspace {
  id: string;
  name: string;
  passwordHash: string;
  treeIds: TreeId[];
}
