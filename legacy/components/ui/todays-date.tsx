"use client";

export const TodaysDate = () => {
  const today = new Date();
  return <>{today.getFullYear()}</>;
};
