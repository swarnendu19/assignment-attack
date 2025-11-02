import { Twilio } from 'twilio';
import { getEnvVar } from '../env';

export interface TwilioTrialInfo {
    accountSid: string;
    trialNumber: string;
    isTrialAccount: boolean;
    balance: string;
    currency: string;
    verifiedNumbers: string[];
    canSendToUnverified: boolean;
}

export interface TwilioNumberInfo {
    phoneNumber: string;
    friendlyName: string;
    capabilities: {
        voice: boolean;
        sms: boolean;
        mms: boolean;
        fax: boolean;
    };
    isTrialNumber: boolean;
}

export interface BuyNumberOptions {
    areaCode?: string;
    contains?: string;
    smsEnabled?: boolean;
    mmsEnabled?: boolean;
    voiceEnabled?: boolean;
}

export class TwilioUtils {
    private client: Twilio;
    private accountSid: string;

    constructor(accountSid?: string, authToken?: string) {
        this.accountSid = accountSid || getEnvVar('TWILIO_ACCOUNT_SID') || '';
        const token = authToken || getEnvVar('TWILIO_AUTH_TOKEN') || '';

        if (!this.accountSid || !token) {
            throw new Error('Twilio credentials are required');
        }

        this.client = new Twilio(this.accountSid, token);
    }

    /**
     * Get trial account information
     */
    async getTrialInfo(): Promise<TwilioTrialInfo> {
        try {
            const account = await this.client.api.accounts(this.accountSid).fetch();

            // Get verified phone numbers for trial accounts
            const outgoingCallerIds = await this.client.outgoingCallerIds.list();
            const verifiedNumbers = outgoingCallerIds.map(caller => caller.phoneNumber);

            // Get trial phone number (usually the first incoming phone number)
            const incomingNumbers = await this.client.incomingPhoneNumbers.list({ limit: 1 });
            const trialNumber = incomingNumbers.length > 0 ? incomingNumbers[0].phoneNumber : '';

            return {
                accountSid: account.sid,
                trialNumber,
                isTrialAccount: account.type === 'Trial',
                balance: account.balance || '0',
                currency: account.balanceCurrency || 'USD',
                verifiedNumbers,
                canSendToUnverified: account.type !== 'Trial'
            };

        } catch (error) {
            throw new Error(`Failed to get trial info: ${error}`);
        }
    }

    /**
     * Get all phone numbers associated with the account
     */
    async getPhoneNumbers(): Promise<TwilioNumberInfo[]> {
        try {
            const numbers = await this.client.incomingPhoneNumbers.list();
            const account = await this.client.api.accounts(this.accountSid).fetch();
            const isTrialAccount = account.type === 'Trial';

            return numbers.map(number => ({
                phoneNumber: number.phoneNumber,
                friendlyName: number.friendlyName || number.phoneNumber,
                capabilities: {
                    voice: number.capabilities.voice || false,
                    sms: number.capabilities.sms || false,
                    mms: number.capabilities.mms || false,
                    fax: number.capabilities.fax || false
                },
                isTrialNumber: isTrialAccount
            }));

        } catch (error) {
            throw new Error(`Failed to get phone numbers: ${error}`);
        }
    }

    /**
     * Search for available phone numbers to purchase
     */
    async searchAvailableNumbers(options: BuyNumberOptions = {}): Promise<any[]> {
        try {
            const searchOptions: any = {
                limit: 20,
                smsEnabled: options.smsEnabled !== false, // Default to true
                mmsEnabled: options.mmsEnabled !== false, // Default to true
                voiceEnabled: options.voiceEnabled !== false // Default to true
            };

            if (options.areaCode) {
                searchOptions.areaCode = options.areaCode;
            }

            if (options.contains) {
                searchOptions.contains = options.contains;
            }

            const availableNumbers = await this.client.availablePhoneNumbers('US')
                .local
                .list(searchOptions);

            return availableNumbers.map(number => ({
                phoneNumber: number.phoneNumber,
                friendlyName: number.friendlyName,
                locality: number.locality,
                region: number.region,
                postalCode: number.postalCode,
                capabilities: number.capabilities,
                beta: number.beta,
                priceUnit: number.priceUnit
            }));

        } catch (error) {
            throw new Error(`Failed to search available numbers: ${error}`);
        }
    }

    /**
     * Purchase a phone number
     */
    async buyPhoneNumber(phoneNumber: string, options: {
        friendlyName?: string;
        smsUrl?: string;
        voiceUrl?: string;
    } = {}): Promise<TwilioNumberInfo> {
        try {
            const purchaseOptions: any = {
                phoneNumber
            };

            if (options.friendlyName) {
                purchaseOptions.friendlyName = options.friendlyName;
            }

            if (options.smsUrl) {
                purchaseOptions.smsUrl = options.smsUrl;
            }

            if (options.voiceUrl) {
                purchaseOptions.voiceUrl = options.voiceUrl;
            }

            const purchasedNumber = await this.client.incomingPhoneNumbers.create(purchaseOptions);

            return {
                phoneNumber: purchasedNumber.phoneNumber,
                friendlyName: purchasedNumber.friendlyName || purchasedNumber.phoneNumber,
                capabilities: {
                    voice: purchasedNumber.capabilities.voice || false,
                    sms: purchasedNumber.capabilities.sms || false,
                    mms: purchasedNumber.capabilities.mms || false,
                    fax: purchasedNumber.capabilities.fax || false
                },
                isTrialNumber: false
            };

        } catch (error) {
            throw new Error(`Failed to buy phone number: ${error}`);
        }
    }

    /**
     * Update webhook URLs for a phone number
     */
    async updateWebhookUrls(phoneNumber: string, options: {
        smsUrl?: string;
        voiceUrl?: string;
        statusCallback?: string;
    }): Promise<void> {
        try {
            // Find the phone number SID
            const numbers = await this.client.incomingPhoneNumbers.list({
                phoneNumber
            });

            if (numbers.length === 0) {
                throw new Error(`Phone number ${phoneNumber} not found`);
            }

            const numberSid = numbers[0].sid;
            const updateOptions: any = {};

            if (options.smsUrl) {
                updateOptions.smsUrl = options.smsUrl;
                updateOptions.smsMethod = 'POST';
            }

            if (options.voiceUrl) {
                updateOptions.voiceUrl = options.voiceUrl;
                updateOptions.voiceMethod = 'POST';
            }

            if (options.statusCallback) {
                updateOptions.statusCallback = options.statusCallback;
                updateOptions.statusCallbackMethod = 'POST';
            }

            await this.client.incomingPhoneNumbers(numberSid).update(updateOptions);

        } catch (error) {
            throw new Error(`Failed to update webhook URLs: ${error}`);
        }
    }

    /**
     * Validate a phone number format
     */
    static validatePhoneNumber(phoneNumber: string): {
        isValid: boolean;
        formatted?: string;
        error?: string;
    } {
        try {
            // Remove all non-digit characters
            const cleaned = phoneNumber.replace(/\D/g, '');

            // Check if it's a valid length
            if (cleaned.length < 10 || cleaned.length > 15) {
                return {
                    isValid: false,
                    error: 'Phone number must be between 10 and 15 digits'
                };
            }

            // Format as E.164 (assuming US numbers if no country code)
            let formatted = cleaned;
            if (cleaned.length === 10) {
                formatted = `+1${cleaned}`;
            } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
                formatted = `+${cleaned}`;
            } else if (!cleaned.startsWith('+')) {
                formatted = `+${cleaned}`;
            }

            return {
                isValid: true,
                formatted
            };

        } catch (error) {
            return {
                isValid: false,
                error: 'Invalid phone number format'
            };
        }
    }

    /**
     * Check if a number is verified (for trial accounts)
     */
    async isNumberVerified(phoneNumber: string): Promise<boolean> {
        try {
            const outgoingCallerIds = await this.client.outgoingCallerIds.list();
            return outgoingCallerIds.some(caller => caller.phoneNumber === phoneNumber);
        } catch (error) {
            return false;
        }
    }

    /**
     * Get message usage statistics
     */
    async getUsageStats(startDate?: Date, endDate?: Date): Promise<{
        smsCount: number;
        mmsCount: number;
        whatsappCount: number;
        totalCost: number;
        currency: string;
    }> {
        try {
            const options: any = {};

            if (startDate) {
                options.startDate = startDate;
            }

            if (endDate) {
                options.endDate = endDate;
            }

            const usage = await this.client.usage.records.list(options);

            let smsCount = 0;
            let mmsCount = 0;
            let whatsappCount = 0;
            let totalCost = 0;
            let currency = 'USD';

            usage.forEach(record => {
                const cost = parseFloat(record.price || '0');
                totalCost += cost;

                if (record.priceUnit) {
                    currency = record.priceUnit;
                }

                switch (record.category) {
                    case 'sms-inbound':
                    case 'sms-outbound':
                        smsCount += parseInt(record.count || '0');
                        break;
                    case 'mms-inbound':
                    case 'mms-outbound':
                        mmsCount += parseInt(record.count || '0');
                        break;
                    case 'whatsapp':
                        whatsappCount += parseInt(record.count || '0');
                        break;
                }
            });

            return {
                smsCount,
                mmsCount,
                whatsappCount,
                totalCost,
                currency
            };

        } catch (error) {
            throw new Error(`Failed to get usage stats: ${error}`);
        }
    }
}