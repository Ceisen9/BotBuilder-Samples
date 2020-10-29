// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { MessageFactory, InputHints } = require('botbuilder');
const { ChoicePrompt, ComponentDialog, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');

const WATERFALL_DIALOG = 'waterfallDialog';

class InsuranceDialog extends ComponentDialog {
    constructor(id) {
        super(id || 'InsuranceDialog');
        this.addDialog(new ChoicePrompt('cardPrompt'));

        // Define the main dialog and its related components.
        // This is a sample "book a flight" dialog.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.insuranceCarrierStep.bind(this),
                this.insuranceNumberStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }


    async insuranceCarrierStep(stepContext) {
        const insuranceDetails = stepContext.options;
        console.log('MainDialog.choiceCardStep');

        // Create the PromptOptions which contain the prompt and re-prompt messages.
        // PromptOptions also contains the list of choices available to the user.
        const options = {
            prompt: 'What insurance provider would you like to use? You can click or type the card name',
            retryPrompt: 'That was not a valid choice, please select a card or number from 1 to 4.',
            choices: this.getChoices()
        };

        // Prompt the user with the configured PromptOptions.
        return await stepContext.prompt('cardPrompt', options);
    }

    async insuranceNumberStep(stepContext) {
        const insuranceDetails = stepContext.options;
        insuranceDetails.carrier = stepContext.result
        const insuranceMessage = "Please provide the insurance number on your account"
        const insurancePromptMessage = MessageFactory.text(insuranceMessage, insuranceMessage, InputHints.ExpectingInput);
        return await stepContext.prompt('TextPrompt', { prompt: insurancePromptMessage });
    }

    async finalStep(stepContext) {
      if (!!stepContext.result) {
          const insuranceDetails = stepContext.options;
          insuranceDetails.insuranceNumber = stepContext.result
          const accountMessage = `You're insurance account with ${ insuranceDetails.carrier.value } and account number ${insuranceDetails.insuranceNumber} was found!` ;
          return await stepContext.context.sendActivity(accountMessage, accountMessage, InputHints.IgnoringInput);
      }
      return await stepContext.endDialog();
    }

    getChoices() {
        const cardOptions = [
            {
                value: 'AIG',
                synonyms: ['aig', 'Aig']
            },
            {
                value: 'Geico',
                synonyms: ['geico']
            },
            {
                value: 'Progressive',
                synonyms: ['progressive']
            },
            {
                value: 'Prudential',
                synonyms: ['prudential']
            }
        ];

        return cardOptions;
    }
}

module.exports.InsuranceDialog = InsuranceDialog;
