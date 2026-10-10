import { CoreApiClient } from 'twenty-client-sdk/core';

import { phoneKey, type CommsContact } from 'src/lib/comms';

/** The parts of a Twenty person this app reads. */
export interface PersonAddresses {
  id: string;
  name: string;
  phones: string[];
  emails: string[];
}

type PhonesValue = {
  primaryPhoneNumber?: string | null;
  primaryPhoneCallingCode?: string | null;
  additionalPhones?:
    | { number?: string | null; callingCode?: string | null }[]
    | null;
} | null;
type EmailsValue = {
  primaryEmail?: string | null;
  additionalEmails?: string[] | null;
} | null;
type PersonNode = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  phones?: PhonesValue;
  emails?: EmailsValue;
};

const PERSON_FIELDS = {
  id: true,
  name: { firstName: true, lastName: true },
  phones: {
    primaryPhoneNumber: true,
    primaryPhoneCallingCode: true,
    additionalPhones: true,
  },
  emails: { primaryEmail: true, additionalEmails: true },
};

function toAddresses(p: PersonNode): PersonAddresses {
  const phones: string[] = [];
  const primary = p.phones?.primaryPhoneNumber;
  if (primary)
    phones.push(`${p.phones?.primaryPhoneCallingCode ?? ''}${primary}`);
  for (const a of p.phones?.additionalPhones ?? []) {
    if (a?.number) phones.push(`${a.callingCode ?? ''}${a.number}`);
  }
  const emails = [p.emails?.primaryEmail, ...(p.emails?.additionalEmails ?? [])]
    .filter((e): e is string => Boolean(e))
    .map((e) => e.toLowerCase());
  const name = [p.name?.firstName, p.name?.lastName].filter(Boolean).join(' ');
  return { id: p.id, name, phones, emails };
}

export async function getPerson(
  client: CoreApiClient,
  personId: string,
): Promise<PersonAddresses | null> {
  const result = await client.query({
    people: {
      __args: { filter: { id: { eq: personId } }, first: 1 },
      edges: { node: PERSON_FIELDS },
    },
  });
  const node = result?.people?.edges?.[0]?.node as PersonNode | undefined;
  return node ? toAddresses(node) : null;
}

/**
 * People in Twenty who are the given Comms contact: any phone number that
 * shares its last ten digits, or any email that matches exactly. Twenty
 * stores numbers in national format beside a calling code, so candidates are
 * narrowed in the query and confirmed here.
 */
export async function findPeopleForContact(
  client: CoreApiClient,
  contact: Pick<CommsContact, 'phones' | 'emails'>,
): Promise<PersonAddresses[]> {
  const keys = contact.phones
    .map(phoneKey)
    .filter((k): k is string => Boolean(k));
  const emails = contact.emails.map((e) => e.toLowerCase());
  const or: Record<string, unknown>[] = [
    ...keys.map((k) => ({
      phones: { primaryPhoneNumber: { like: `%${k.slice(-7)}` } },
    })),
    ...emails.map((e) => ({ emails: { primaryEmail: { ilike: e } } })),
  ];
  if (or.length === 0) return [];

  const result = await client.query({
    people: {
      __args: { filter: { or }, first: 20 },
      edges: { node: PERSON_FIELDS },
    },
  });
  const nodes = (result?.people?.edges ?? []).map(
    (e: { node: PersonNode }) => e.node,
  );
  return nodes.map(toAddresses).filter(
    (p: PersonAddresses) =>
      p.phones.some((ph) => {
        const k = phoneKey(ph);
        return k !== null && keys.includes(k);
      }) || p.emails.some((e) => emails.includes(e)),
  );
}
