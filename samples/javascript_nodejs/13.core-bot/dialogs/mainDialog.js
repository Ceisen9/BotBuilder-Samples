// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { MessageFactory, InputHints } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { ChoicePrompt, ComponentDialog, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const moment = require('moment-timezone');
const { InsuranceDialog } = require('./insuranceDialog');
const { BookingDialog } = require('./BookingDialog');
const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';

class MainDialog extends ComponentDialog {
    constructor(luisRecognizer, bookingDialog) {
        super('MainDialog');
        this.addDialog(new ChoicePrompt('cardPrompt'));
        this.addDialog(new InsuranceDialog('insuranceDialog'))
        this.addDialog(new BookingDialog('bookingDialog'))


        if (!luisRecognizer) {
            throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        } 
        this.luisRecognizer = luisRecognizer;
        this.insuranceDetails = {}

        if (!bookingDialog) throw new Error('[MainDialog]: Missing parameter \'bookingDialog\' is required');

        // Define the main dialog and its related components.
        // This is a sample "book a flight" dialog.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.actStep.bind(this),
                this.actStep.bind(this),
                this.actStep.bind(this),
                this.bookingStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     * Currently, this expects a booking request, like "book me a flight from Paris to Berlin on march 22"
     * Note that the sample LUIS model will only recognize Paris, Berlin, New York and London as airport cities.
     */
    async introStep(stepContext) {
        if (!this.luisRecognizer.isConfigured) {
            const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
            await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await stepContext.next();
        }

        const messageText = stepContext.options.restartMsg ? stepContext.options.restartMsg : `Welcome to AEG's automated chat help line. What can we help you with today?\nSay something like "asbestos"`;
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt('TextPrompt', { prompt: promptMessage });
    }

    async bookingStep(stepContext) {
        this.insuranceDetails = stepContext.result
        const bookingDetails = {};
        return await stepContext.beginDialog('bookingDialog', bookingDetails);
    }

    async actStep(stepContext) {
        const insuranceDetails = {}

        // Call LUIS and gather any potential booking details. (Note the TurnContext has the response to the prompt)
        const luisResult = await this.luisRecognizer.executeLuisQuery(stepContext.context);
        switch (LuisRecognizer.topIntent(luisResult)) {
            case 'AsbestosAppointment': {
                const aMessageText = "It looks like you need help with an asbestos problem. Would you like to book an appointment for an inspection?";
                const aPromptMessage = MessageFactory.text(aMessageText, aMessageText, InputHints.ExpectingInput);
                return await stepContext.prompt('TextPrompt', { prompt: aPromptMessage });
            }

            case 'Utilities_Confirm': {
                const confirmMessage = "Great! Let's get started with creating you an appointment. First we need to ask a few questions. Will you be paying for this inspection with insurance or out of pocket?"
                const confirmPromptMessage = MessageFactory.text(confirmMessage, confirmMessage, InputHints.ExpectingInput);
                return await stepContext.prompt('TextPrompt', { prompt: confirmPromptMessage });
            }

            case 'Insurance': {
                return await stepContext.beginDialog('insuranceDialog', insuranceDetails);
            }

            case 'Pocket': {
                return await stepContext.next()
            }

            default: {
                // Catch all for unhandled intents
                const didntUnderstandMessageText = `Sorry, I didn't get that. Please try asking in a different way (intent was ${ LuisRecognizer.topIntent(luisResult) })`;
                return await stepContext.replaceDialog(this.initialDialogId, { restartMsg: didntUnderstandMessageText });
            }
        }
        
        return await stepContext.next();
    }

    async finalStep(stepContext) {
        // If the child dialog ("bookingDialog") was cancelled or the user failed to confirm, the Result here will be null.
        if (stepContext.result) {
            const bookingDetails = stepContext.result
            const confirmMessage = `You are all booked for an an asbestos inspection on ${ bookingDetails.travelDate } at the address ${ bookingDetails.destination } in ${ bookingDetails.origin } one of our inspectors for at 8am.` 
            await stepContext.context.sendActivity(confirmMessage, confirmMessage, InputHints.IgnoringInput);
        }

        // Restart the main dialog with a different message the second time around
        return await stepContext.replaceDialog(this.initialDialogId, { restartMsg: 'What else can I do for you?' });
    }
}

module.exports.MainDialog = MainDialog;
