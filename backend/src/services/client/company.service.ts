import databaseService from '~/configs/database.config'
import { ObjectId } from 'mongodb'
import Company from '~/models/schema/client/companies.schema'
import uploadThingProvider from '~/providers/uploadthing.provider'

export type PublicCompanyDetail = {
  _id: ObjectId
  company_name: string
  logo?: string
  website?: string
  address: string
  description?: string
  verified?: boolean
}

class CompanyService {
  async createCompany(data: Company) {
    return databaseService.companies.insertOne(data)
  }

  async updateCompany(companyId: ObjectId, data: Partial<Company>) {
    return databaseService.companies.updateOne(
      { _id: companyId },
      {
        $set: {
          ...data,
          updated_at: new Date()
        }
      }
    )
  }

  async updateLogo(company: Company, payload: { logo: string; logo_file_key: string }) {
    const oldLogoFileKey = company.logo_file_key

    await databaseService.companies.updateOne(
      { _id: company._id },
      {
        $set: {
          logo: payload.logo,
          logo_file_key: payload.logo_file_key,
          updated_at: new Date()
        }
      }
    )

    if (oldLogoFileKey && oldLogoFileKey !== payload.logo_file_key) {
      await uploadThingProvider.deleteFile(oldLogoFileKey)
    }
  }

  async getPublicCompanyDetail(companyId: string): Promise<PublicCompanyDetail | null> {
    if (!ObjectId.isValid(companyId)) {
      return null
    }

    return databaseService.companies.findOne(
      { _id: new ObjectId(companyId) },
      {
        projection: {
          _id: 1,
          company_name: 1,
          logo: 1,
          website: 1,
          address: 1,
          description: 1,
          verified: 1
        }
      }
    )
  }
}

const companyService = new CompanyService()
export default companyService

