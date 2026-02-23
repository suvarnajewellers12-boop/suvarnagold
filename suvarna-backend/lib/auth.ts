import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET!;

export const hashPassword = async (password: string) =>
  bcrypt.hash(password, 10);

export const comparePassword = async (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export const generateToken = (payload: any) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

export const verifyToken = (token: string) =>
  jwt.verify(token, JWT_SECRET);
