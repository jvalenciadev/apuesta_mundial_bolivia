-- Migration 002: Prize distribution logic
-- Run this in Supabase SQL Editor

-- Add prize_won column to bets (amount won in Bs.)
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS prize_won numeric(10,2) DEFAULT 0 NOT NULL;

-- Add rollover_pool to matches (accumulated unclaimed pool from previous matches)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS rollover_pool numeric(10,2) DEFAULT 0 NOT NULL;

-- Add prize_distributed flag to avoid re-processing
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS prize_distributed boolean DEFAULT false NOT NULL;
