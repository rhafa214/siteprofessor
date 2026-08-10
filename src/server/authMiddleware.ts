import { Request, Response, NextFunction } from 'express';
import { adminAuth } from './firebaseAdmin.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!adminAuth) {
    res.status(503).json({ error: 'Serviço de autenticação não configurado no backend.' });
    return;
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Acesso negado. Token de autenticação não fornecido ou malformado.' });
    return;
  }

  const token = authHeader.split('Bearer ')[1].trim();

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    
    next();
  } catch (error: any) {
    console.error('Auth verification error:', error.message);
    res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
  }
};

export const requireAuthorizedUser = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Configuração por variável de ambiente
  const allowedUidsRaw = process.env.AUTHORIZED_FIREBASE_UIDS || process.env.VITE_AUTHORIZED_FIREBASE_UIDS;
  
  if (!allowedUidsRaw) {
    res.status(503).json({ error: 'Serviço indisponível: Allowlist de autorização não configurada.' });
    return;
  }

  if (!req.user || !req.user.uid) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  const allowedUids = allowedUidsRaw.split(',').map(uid => uid.trim());

  if (!allowedUids.includes(req.user.uid)) {
    console.warn(`Tentativa de acesso não autorizada. UID: ${req.user.uid}`);
    res.status(403).json({ error: 'Acesso negado. Usuário não autorizado a utilizar este recurso.' });
    return;
  }

  next();
};
