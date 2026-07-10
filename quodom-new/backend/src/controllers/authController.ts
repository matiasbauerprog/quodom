import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'super_secret_quodom_development_jwt_key_32_chars';
}

function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || '7d';
}

export async function signup(req: Request, res: Response) {
  try {
    const { email, password, name, company, cuit, whatsapp, address } = req.body;

    if (!email || !password || !name || !whatsapp) {
      return res.status(400).json({ error: 'Missing required fields: email, password, name, and whatsapp are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        company: company || null,
        cuit: cuit || null,
        whatsapp,
        address: address || null,
      },
    });

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: getJwtExpiresIn() as any });

    // Exclude passwordHash from response user object
    const { passwordHash: _, ...userWithoutPassword } = user;

    return res.status(201).json({
      token,
      user: userWithoutPassword,
    });
  } catch (error: any) {
    if (error && error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already registered' });
    }
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: getJwtExpiresIn() as any });

    // Exclude passwordHash from response user object
    const { passwordHash: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
}

export async function me(req: Request, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { passwordHash: _, ...userWithoutPassword } = user;

    return res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error('Me error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
