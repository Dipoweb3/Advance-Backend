import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { User } from '../models/User';
import { TokenPayload, UserRole } from '../types';
import { CreationAttributes } from 'sequelize';
import crypto from 'crypto';

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;

    const user = await User.findByPk(decoded.userId);
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: 'Account is deactivated' });
      return;
    }

    req.user = {
      userId: user.id,
      role: user.role,
      walletAddress: user.walletAddress
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const authenticateWeb3 = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { signature, message, address } = req.body;
    if (!signature || !message || !address) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    // Verify signature and message
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      res.status(401).json({ message: 'Invalid signature' });
      return;
    }

    let user = await User.findOne({ where: { walletAddress: address } });
    
    if (!user) {
      // Create new user if not exists
      user = await User.create({
        walletAddress: address,
        role: UserRole.WEB3_USER,
        email: `${address.slice(0, 6)}...${address.slice(-4)}@web3.user`,
        password: crypto.randomBytes(32).toString('hex'),
        isActive: true
      } as CreationAttributes<User>);
    }

    if (!user.isActive) {
      res.status(403).json({ message: 'Account is deactivated' });
      return;
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        walletAddress: user.walletAddress
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    req.user = {
      userId: user.id,
      role: user.role,
      walletAddress: user.walletAddress
    };

    res.json({ token, user: { id: user.id, role: user.role, walletAddress: user.walletAddress } });
    next();
  } catch (error) {
    console.error('Web3 auth middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}; 