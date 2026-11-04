const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// bcrypt hash for "password" (cost 10)
const PASSWORD_HASH = '$2y$10$wOQVaUDWzYuj7.djoxKyLeNSFW027.4jYa8r/fJZFxNTE9hU6X.2K';

const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
function randomId(prefix, len = 16) {
  let res = '';
  for (let i = 0; i < len; i++) {
    res += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return prefix ? `${prefix}_${res}` : res;
}

const TINY_PDF_B64 =
  'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQo+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE4IDAwMDAwIG4gCjAwMDAwMDAwNzAgMDAwMDAgbiAKMDAwMDAwMDEyNSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDQKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjE5MQolJUVPRg==';

async function seed() {
  console.log('🚀 Starting SignMatrix-Engine Production Seed...');

  // 1. Check if envelopes already exist
  const existingEnvelopes = await prisma.envelope.count();
  if (existingEnvelopes >= 1000) {
    console.log(`✅ Already seeded with ${existingEnvelopes} envelopes. Skipping.`);
    return;
  }

  // 2. Initialize Counter
  console.log('📦 Initializing Counter...');
  await prisma.counter.upsert({
    where: { id: 'document' },
    update: {},
    create: {
      id: 'document',
      value: 1020,
    },
  });

  await prisma.counter.upsert({
    where: { id: 'template' },
    update: {},
    create: {
      id: 'template',
      value: 100,
    },
  });

  // 3. Initialize SubscriptionClaims
  console.log('📦 Initializing SubscriptionClaims...');
  const claims = [
    {
      id: 'free',
      name: 'Free',
      locked: true,
      teamCount: 1,
      memberCount: 1,
      envelopeItemCount: 5,
      recipientCount: 10,
      flags: {},
    },
    {
      id: 'individual',
      name: 'Individual',
      locked: true,
      teamCount: 1,
      memberCount: 1,
      envelopeItemCount: 5,
      recipientCount: 10,
      flags: { unlimitedDocuments: true },
    },
    {
      id: 'team',
      name: 'Teams',
      locked: true,
      teamCount: 1,
      memberCount: 5,
      envelopeItemCount: 5,
      recipientCount: 10,
      flags: { unlimitedDocuments: true, allowCustomBranding: true, embedSigning: true },
    },
    {
      id: 'platform',
      name: 'Platform',
      locked: true,
      teamCount: 1,
      memberCount: 0,
      envelopeItemCount: 10,
      recipientCount: 10,
      flags: { unlimitedDocuments: true, allowCustomBranding: true, hidePoweredBy: true },
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      locked: true,
      teamCount: 0,
      memberCount: 0,
      envelopeItemCount: 10,
      recipientCount: 10,
      flags: { unlimitedDocuments: true, allowCustomBranding: true, hidePoweredBy: true, cfr21: true },
    },
    {
      id: 'earlyAdopter',
      name: 'Early Adopter',
      locked: true,
      teamCount: 0,
      memberCount: 0,
      envelopeItemCount: 5,
      recipientCount: 10,
      flags: { unlimitedDocuments: true, allowCustomBranding: true, hidePoweredBy: true },
    },
  ];

  for (const c of claims) {
    await prisma.subscriptionClaim.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        name: c.name,
        locked: c.locked,
        teamCount: c.teamCount,
        memberCount: c.memberCount,
        envelopeItemCount: c.envelopeItemCount,
        recipientCount: c.recipientCount,
        flags: c.flags,
        documentRateLimits: [],
        emailRateLimits: [],
        apiRateLimits: [],
      },
    });
  }

  // Helper to create user + personal org + team
  async function createFullUser({ name, email, roles = ['USER'], isAdmin = false }) {
    let user = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password: PASSWORD_HASH,
          roles: isAdmin ? ['USER', 'ADMIN'] : roles,
          emailVerified: new Date(),
        },
      });
    }

    // Check if organisation exists
    let org = await prisma.organisation.findFirst({
      where: { ownerUserId: user.id },
      include: { teams: true },
    });

    let team;

    if (!org) {
      const orgSetting = await prisma.organisationGlobalSettings.create({
        data: {
          id: randomId('org_setting'),
          emailDocumentSettings: {},
        },
      });

      const orgClaim = await prisma.organisationClaim.create({
        data: {
          id: randomId('org_claim'),
          originalSubscriptionClaimId: 'free',
          teamCount: 1,
          memberCount: 1,
          envelopeItemCount: 5,
          recipientCount: 10,
          flags: {},
          documentRateLimits: [],
          emailRateLimits: [],
          apiRateLimits: [],
        },
      });

      const ssoPortal = await prisma.organisationAuthenticationPortal.create({
        data: {
          id: randomId('org_sso'),
          enabled: false,
          clientId: '',
          clientSecret: '',
          wellKnownUrl: '',
        },
      });

      const orgId = randomId('org');
      org = await prisma.organisation.create({
        data: {
          id: orgId,
          name: 'Personal Organisation',
          type: 'PERSONAL',
          url: orgId,
          ownerUserId: user.id,
          organisationGlobalSettingsId: orgSetting.id,
          organisationClaimId: orgClaim.id,
          organisationAuthenticationPortalId: ssoPortal.id,
        },
      });

      const member = await prisma.organisationMember.create({
        data: {
          id: randomId('member'),
          userId: user.id,
          organisationId: org.id,
        },
      });

      const groupAdmin = await prisma.organisationGroup.create({
        data: {
          id: randomId('org_group'),
          name: 'Admin',
          type: 'INTERNAL_ORGANISATION',
          organisationRole: 'ADMIN',
          organisationId: org.id,
        },
      });

      await prisma.organisationGroupMember.create({
        data: {
          id: randomId('group_member'),
          groupId: groupAdmin.id,
          organisationMemberId: member.id,
        },
      });

      const teamSetting = await prisma.teamGlobalSettings.create({
        data: { id: randomId('team_setting') },
      });

      const teamUrl = randomId('personal');
      team = await prisma.team.create({
        data: {
          name: 'Personal Team',
          url: teamUrl,
          organisationId: org.id,
          teamGlobalSettingsId: teamSetting.id,
        },
      });

      await prisma.teamGroup.create({
        data: {
          id: randomId('team_group'),
          teamId: team.id,
          organisationGroupId: groupAdmin.id,
          teamRole: 'ADMIN',
        },
      });
    } else {
      team = org.teams[0];
    }

    return { user, org, team };
  }

  // 4. Create the 5 Users
  console.log('👤 Creating Users & Organizations...');
  const adminObj = await createFullUser({
    name: 'Admin User',
    email: 'admin@documenso.com',
    isAdmin: true,
  });

  const exampleObj = await createFullUser({
    name: 'Example User',
    email: 'example@documenso.com',
  });

  const mediumObj = await createFullUser({
    name: 'Medium Account',
    email: 'medium-account@documenso.com',
  });

  const serviceObj = await createFullUser({
    name: 'Service Account',
    email: 'serviceaccount@documenso.com',
  });

  const deletedObj = await createFullUser({
    name: null,
    email: 'deleted-account@documenso.com',
  });

  // Helper to create an envelope
  let docSeq = 1;
  async function createDoc({ userId, teamId, title, status = 'DRAFT', createdAt = new Date() }) {
    const docData = await prisma.documentData.create({
      data: {
        type: 'BYTES_64',
        data: TINY_PDF_B64,
        initialData: TINY_PDF_B64,
      },
    });

    const docMeta = await prisma.documentMeta.create({ data: {} });

    const envelopeId = randomId('envelope');
    const secondaryId = `document_${docSeq++}`;

    const env = await prisma.envelope.create({
      data: {
        id: envelopeId,
        secondaryId,
        internalVersion: 1,
        signatureLevel: 'SES',
        type: 'DOCUMENT',
        documentMetaId: docMeta.id,
        source: 'DOCUMENT',
        userId,
        teamId,
        title,
        status,
        createdAt,
        envelopeItems: {
          create: {
            id: randomId('envelope_item'),
            title,
            documentDataId: docData.id,
            order: 1,
          },
        },
        recipients: {
          create: {
            email: 'admin@documenso.com',
            name: 'Admin User',
            token: randomId('', 16),
            signingStatus: status === 'COMPLETED' ? 'SIGNED' : 'NOT_SIGNED',
          },
        },
      },
    });

    return env;
  }

  // 5. Create Admin Documents (Matching Screenshot 1 exactly!)
  console.log('📄 Creating Admin Documents (Screenshot 1)...');
  const now = new Date();
  const d1 = new Date(now.getTime() - 15 * 60 * 1000); // 15 mins ago
  const d2 = new Date(now.getTime() - 30 * 60 * 1000); // 30 mins ago

  await createDoc({
    userId: adminObj.user.id,
    teamId: adminObj.team.id,
    title: 'xfHTU.pdf',
    status: 'DRAFT',
    createdAt: now,
  });
  await createDoc({
    userId: adminObj.user.id,
    teamId: adminObj.team.id,
    title: 'Envelope Full Field Test',
    status: 'DRAFT',
    createdAt: d1,
  });
  await createDoc({
    userId: adminObj.user.id,
    teamId: adminObj.team.id,
    title: 'Envelope Full Field Test',
    status: 'PENDING',
    createdAt: d1,
  });
  await createDoc({
    userId: adminObj.user.id,
    teamId: adminObj.team.id,
    title: 'Overflow Test',
    status: 'DRAFT',
    createdAt: d2,
  });
  await createDoc({
    userId: adminObj.user.id,
    teamId: adminObj.team.id,
    title: 'Pending Document',
    status: 'PENDING',
    createdAt: d2,
  });

  // 6. Create Medium Account Documents (~1,012 documents to match Screenshot 3: 1,017 total)
  // Target: Drafted: 347, Pending: 337, Completed: 333
  // Admin already has: 3 Draft, 2 Pending.
  // Medium needs: 344 Draft, 335 Pending, 333 Completed.
  console.log('📚 Creating Batch Documents for Medium Account (~1,012 docs)...');

  const batchSize = 50;
  const targetCounts = {
    DRAFT: 344,
    PENDING: 335,
    COMPLETED: 333,
  };

  const statuses = [];
  for (let i = 0; i < targetCounts.DRAFT; i++) {
    statuses.push('DRAFT');
  }
  for (let i = 0; i < targetCounts.PENDING; i++) {
    statuses.push('PENDING');
  }
  for (let i = 0; i < targetCounts.COMPLETED; i++) {
    statuses.push('COMPLETED');
  }

  for (let i = 0; i < statuses.length; i += batchSize) {
    const chunk = statuses.slice(i, i + batchSize);
    await Promise.all(
      chunk.map((st, idx) => {
        const itemIndex = i + idx;
        return createDoc({
          userId: mediumObj.user.id,
          teamId: mediumObj.team.id,
          title: `[MEDIUM] Document ${itemIndex} - ${st}`,
          status: st,
          createdAt: new Date(now.getTime() - (itemIndex + 1) * 60 * 1000),
        });
      }),
    );
    process.stdout.write(`\r   Seeded ${Math.min(i + batchSize, statuses.length)} / ${statuses.length} documents...`);
  }
  console.log('\n');

  const totalUsers = await prisma.user.count();
  const totalOrgs = await prisma.organisation.count();
  const totalDocs = await prisma.envelope.count();
  const draftDocs = await prisma.envelope.count({ where: { status: 'DRAFT' } });
  const pendingDocs = await prisma.envelope.count({ where: { status: 'PENDING' } });
  const completedDocs = await prisma.envelope.count({ where: { status: 'COMPLETED' } });

  console.log('🎉 Seed Completed Successfully!');
  console.log(`   Total Users: ${totalUsers}`);
  console.log(`   Total Organizations: ${totalOrgs}`);
  console.log(`   Total Documents: ${totalDocs}`);
  console.log(`     - Draft: ${draftDocs}`);
  console.log(`     - Pending: ${pendingDocs}`);
  console.log(`     - Completed: ${completedDocs}`);
}

seed()
  .catch((err) => {
    console.error('❌ Seed Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
