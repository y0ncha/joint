export type Account = {
  id: string;
  kind: "bank" | "credit_card";
  openingBalance: number;
};

export type Transaction =
  | {
      type: "income";
      accountId: string;
      amount: number;
    }
  | {
      type: "expense";
      accountId: string;
      amount: number;
    }
  | {
      type: "transfer";
      sourceAccountId: string;
      destinationAccountId: string;
      amount: number;
    };

export type AccountBalance = {
  accountId: string;
  balance: number;
};

export type HouseholdBalances = {
  accounts: AccountBalance[];
  totalExpenses: number;
};

export function calculateHouseholdBalances(
  accounts: Account[],
  transactions: Transaction[],
): HouseholdBalances {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const balances = new Map(
    accounts.map((account) => [account.id, account.openingBalance]),
  );
  let totalExpenses = 0;

  for (const transaction of transactions) {
    if (transaction.type === "income") {
      const account = accountsById.get(transaction.accountId);
      if (!account) {
        throw new Error(`Unknown account: ${transaction.accountId}`);
      }
      if (account.kind !== "bank") {
        throw new Error("Income must target a bank account");
      }

      balances.set(
        transaction.accountId,
        balances.get(transaction.accountId)! + transaction.amount,
      );
      continue;
    }

    if (transaction.type === "expense") {
      const account = accountsById.get(transaction.accountId);
      if (!account) {
        throw new Error(`Unknown account: ${transaction.accountId}`);
      }

      totalExpenses += transaction.amount;
      const direction = account.kind === "credit_card" ? 1 : -1;

      balances.set(
        transaction.accountId,
        balances.get(transaction.accountId)! + direction * transaction.amount,
      );
      continue;
    }

    const sourceAccount = accountsById.get(transaction.sourceAccountId);
    const destinationAccount = accountsById.get(transaction.destinationAccountId);
    if (!sourceAccount) {
      throw new Error(`Unknown account: ${transaction.sourceAccountId}`);
    }
    if (!destinationAccount) {
      throw new Error(`Unknown account: ${transaction.destinationAccountId}`);
    }
    if (sourceAccount.kind !== "bank" || destinationAccount.kind !== "credit_card") {
      throw new Error("Transfers must be from a bank account to a credit card");
    }

    balances.set(
      transaction.sourceAccountId,
      balances.get(transaction.sourceAccountId)! - transaction.amount,
    );
    balances.set(
      transaction.destinationAccountId,
      balances.get(transaction.destinationAccountId)! - transaction.amount,
    );
  }

  return {
    accounts: accounts.map(({ id }) => ({
      accountId: id,
      balance: balances.get(id) ?? 0,
    })),
    totalExpenses,
  };
}
