import { OrganisationService } from './organisation.service';
import { OrganisationRepository } from './organisation.repository';
import { UpdateOrganisationSetupDto } from './dto/update-organisation-setup.dto';

describe('OrganisationService owner setup permissions', () => {
  const organisationRepository = {
    findById: jest.fn(),
  } as unknown as OrganisationRepository;
  const service = new OrganisationService(organisationRepository);
  let updateSetupSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    updateSetupSpy = jest.spyOn(service, 'updateSetup').mockResolvedValue({
      message: 'Organization setup saved successfully.',
      organisation: {},
    } as never);
    jest.spyOn(organisationRepository, 'findById').mockResolvedValue({
      id: 'organization-id',
      slug: 'my-salon',
      status: 'onboarding',
    } as never);
  });

  it('keeps organization status and tax approval decisions under Super Admin control', async () => {
    const setup = {
      profile: {
        name: 'My Salon',
        slug: 'my-salon',
        status: 'active',
      },
      taxProfile: {
        taxIdentifierNumber: 'GSTIN',
        verificationStatus: 'verified',
        verificationNotes: 'Owner submitted this value',
      },
    } as UpdateOrganisationSetupDto;

    await service.updateOwnerSetup(
      'organization-id',
      setup,
      'owner-user-id',
      '127.0.0.1',
    );

    expect(updateSetupSpy).toHaveBeenCalledWith(
      'organization-id',
      expect.objectContaining({
        profile: expect.objectContaining({ status: 'onboarding' }),
        taxProfile: expect.objectContaining({
          verificationStatus: undefined,
          verificationNotes: undefined,
        }),
      }),
      'owner-user-id',
      '127.0.0.1',
    );
  });
});
