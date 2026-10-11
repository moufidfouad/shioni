import "express";

// Augmente le type Request d'Express pour porter l'utilisateur authentifié
// une fois le middleware "authenticate" passé.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        isSuperAdmin: boolean;
      };
    }
  }
}

export {};
