import { and, eq } from "drizzle-orm";
import { verifyMessage } from "viem";
import crypto from "crypto";
import { db, DB } from "../db/index.js";
import { wallets } from "../db/schema.js";
import type { Wallet } from "../types/index.js";
import { logger } from "../utils/logger.js";

export class WalletService {
  constructor(private readonly database: DB = db) {}

  /**
   * Normalizes an Ethereum / EVM address to lowercase.
   */
  normalizeAddress(address: string): string {
    if (!address || typeof address !== "string") return "";
    return address.trim().toLowerCase();
  }

  /**
   * Builds the deterministic standard sign-in message for nonce verification.
   */
  buildVerificationMessage(address: string, nonce: string): string {
    return (
      `Birthday & Reminder App Verification\n\n` +
      `Please sign this message to verify ownership of your wallet.\n` +
      `No blockchain transaction or gas fee is required.\n\n` +
      `Wallet: ${address}\n` +
      `Nonce: ${nonce}`
    );
  }

  /**
   * Fetches the connected wallet for a user.
   */
  async getWalletByUser(userId: string): Promise<Wallet | null> {
    const results = await this.database
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (results.length === 0) return null;
    return results[0] as unknown as Wallet;
  }

  /**
   * Generates a single-use verification nonce with a 5-minute expiration.
   */
  async generateVerificationNonce(
    userId: string,
    address: string,
    chain: string = "ethereum"
  ): Promise<{ nonce: string; message: string; expiresAt: Date }> {
    const normalizedAddr = this.normalizeAddress(address);
    if (!/^0x[a-f0-9]{40}$/i.test(normalizedAddr)) {
      throw new Error("Invalid EVM wallet address format.");
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity
    const message = this.buildVerificationMessage(normalizedAddr, nonce);

    // Check if user already has a wallet record
    const [existing] = await this.database
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (existing) {
      await this.database
        .update(wallets)
        .set({
          address: normalizedAddr,
          chain,
          isVerified: false,
          verificationNonce: nonce,
          nonceExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, existing.id));
    } else {
      await this.database.insert(wallets).values({
        userId,
        address: normalizedAddr,
        chain,
        isVerified: false,
        verificationNonce: nonce,
        nonceExpiresAt: expiresAt,
      });
    }

    logger.info(`Generated verification nonce for user ${userId} and wallet ${normalizedAddr}`);

    return {
      nonce,
      message,
      expiresAt,
    };
  }

  /**
   * Verifies the cryptographic signature against the active nonce and marks the wallet verified.
   */
  async verifyWalletSignature(
    userId: string,
    address: string,
    signature: string
  ): Promise<{ success: boolean; wallet: Wallet | null; error?: string }> {
    const normalizedAddr = this.normalizeAddress(address);

    const [walletRecord] = await this.database
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.address, normalizedAddr)))
      .limit(1);

    if (!walletRecord) {
      return { success: false, wallet: null, error: "No pending verification found for this wallet." };
    }

    if (!walletRecord.verificationNonce || !walletRecord.nonceExpiresAt) {
      return { success: false, wallet: null, error: "Verification nonce not found. Please request a new nonce." };
    }

    if (new Date() > new Date(walletRecord.nonceExpiresAt)) {
      return { success: false, wallet: null, error: "Verification nonce has expired. Please try again." };
    }

    const expectedMessage = this.buildVerificationMessage(
      normalizedAddr,
      walletRecord.verificationNonce
    );

    try {
      const isValid = await verifyMessage({
        address: normalizedAddr as `0x${string}`,
        message: expectedMessage,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        logger.warn(`Signature verification failed for wallet ${normalizedAddr}`);
        return { success: false, wallet: null, error: "Invalid cryptographic signature." };
      }

      // Mark verified and clear nonce immediately to prevent replay
      const [updated] = await this.database
        .update(wallets)
        .set({
          isVerified: true,
          verifiedAt: new Date(),
          verificationNonce: null,
          nonceExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, walletRecord.id))
        .returning();

      logger.info(`Wallet ${normalizedAddr} successfully verified for user ${userId}`);

      return {
        success: true,
        wallet: updated as unknown as Wallet,
      };
    } catch (err: any) {
      logger.error(`Error verifying signature for wallet ${normalizedAddr}:`, err);
      return { success: false, wallet: null, error: err.message || "Failed to verify signature." };
    }
  }

  /**
   * Disconnects and removes wallet association for a user.
   */
  async disconnectWallet(userId: string): Promise<boolean> {
    await this.database.delete(wallets).where(eq(wallets.userId, userId));
    logger.info(`Disconnected wallet for user ${userId}`);
    return true;
  }
}

export const walletService = new WalletService();
