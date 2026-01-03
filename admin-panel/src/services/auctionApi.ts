import { postEncrypted } from "./sharedEncryptedRequest";
import { API_TAGS, API_ROUTES, DEFAULT_LANGUAGE } from "../config/appConfig";

// Auction Methods
export const fetchAuctionMethods = async ({ username, language = DEFAULT_LANGUAGE, filters = {} }: { username: string; language?: string; filters?: Record<string, any> }) =>
  postEncrypted(API_ROUTES.admin.getAuctionMethods, { api: API_TAGS.AUCTION_METHODS.list, username, language, ...filters });

export const createAuctionMethod = async ({ username, language = DEFAULT_LANGUAGE, payload }: { username: string; language?: string; payload: Record<string, any> }) =>
  postEncrypted(API_ROUTES.admin.createAuctionMethod, { api: API_TAGS.AUCTION_METHODS.create, username, language, ...payload });

export const updateAuctionMethod = async ({ username, language = DEFAULT_LANGUAGE, payload }: { username: string; language?: string; payload: Record<string, any> }) =>
  postEncrypted(API_ROUTES.admin.updateAuctionMethod, { api: API_TAGS.AUCTION_METHODS.update, username, language, ...payload });

export const deactivateAuctionMethod = async ({ username, language = DEFAULT_LANGUAGE, method_code }: { username: string; language?: string; method_code: string }) =>
  postEncrypted(API_ROUTES.admin.deactivateAuctionMethod, { api: API_TAGS.AUCTION_METHODS.deactivate, username, language, method_code });

// Auction Rounds
export const fetchAuctionRounds = async ({ username, language = DEFAULT_LANGUAGE, filters = {} }: { username: string; language?: string; filters?: Record<string, any> }) =>
  postEncrypted(API_ROUTES.admin.getAuctionRounds, { api: API_TAGS.AUCTION_ROUNDS.list, username, language, ...filters });

export const createAuctionRound = async ({ username, language = DEFAULT_LANGUAGE, payload }: { username: string; language?: string; payload: Record<string, any> }) =>
  postEncrypted(API_ROUTES.admin.createAuctionRound, { api: API_TAGS.AUCTION_ROUNDS.create, username, language, ...payload });

export const updateAuctionRound = async ({ username, language = DEFAULT_LANGUAGE, payload }: { username: string; language?: string; payload: Record<string, any> }) =>
  postEncrypted(API_ROUTES.admin.updateAuctionRound, { api: API_TAGS.AUCTION_ROUNDS.update, username, language, ...payload });

export const deactivateAuctionRound = async ({ username, language = DEFAULT_LANGUAGE, round_code }: { username: string; language?: string; round_code: string }) =>
  postEncrypted(API_ROUTES.admin.deactivateAuctionRound, { api: API_TAGS.AUCTION_ROUNDS.deactivate, username, language, round_code });

// Auction Policies
export const fetchAuctionPolicies = async ({ username, language = DEFAULT_LANGUAGE, filters = {} }: { username: string; language?: string; filters?: Record<string, any> }) =>
  postEncrypted(API_ROUTES.admin.getMandiAuctionPolicies, { api: API_TAGS.AUCTION_POLICIES.list, username, language, ...filters });

export const createAuctionPolicy = async ({ username, language = DEFAULT_LANGUAGE, payload }: { username: string; language?: string; payload: Record<string, any> }) =>
  postEncrypted(API_ROUTES.admin.createMandiAuctionPolicy, { api: API_TAGS.AUCTION_POLICIES.create, username, language, ...payload });

export const updateAuctionPolicy = async ({ username, language = DEFAULT_LANGUAGE, payload }: { username: string; language?: string; payload: Record<string, any> }) =>
  postEncrypted(API_ROUTES.admin.updateMandiAuctionPolicy, { api: API_TAGS.AUCTION_POLICIES.update, username, language, ...payload });

export const deactivateAuctionPolicy = async ({ username, language = DEFAULT_LANGUAGE, policy_id }: { username: string; language?: string; policy_id: string }) =>
  postEncrypted(API_ROUTES.admin.deactivateMandiAuctionPolicy, { api: API_TAGS.AUCTION_POLICIES.deactivate, username, language, policy_id });
