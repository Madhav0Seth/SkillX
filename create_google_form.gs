/**
 * SkillX - Automated Google Form Generator Script
 * 
 * HOW TO USE (Takes 10 Seconds):
 * 1. Open https://script.google.com and click "New project"
 * 2. Paste this entire code into Code.gs
 * 3. Click "Run" at the top!
 * 4. Check your Google Drive — your complete SkillX Google Form will be ready instantly!
 */

function createSkillXFeedbackForm() {
  // Create a new Google Form
  var form = FormApp.create('SkillX - User Onboarding & Feedback Form');
  
  form.setDescription(
    'Thank you for testing SkillX — the decentralized freelancing platform built on Stellar Testnet! ' +
    'Please share your testnet wallet address and feedback below.'
  );
  
  // 1. Full Name
  form.addTextItem()
      .setTitle('Full Name')
      .setRequired(true);

  // 2. Email Address
  form.addTextItem()
      .setTitle('Email Address')
      .setRequired(true);

  // 3. Stellar Testnet Wallet Address
  form.addTextItem()
      .setTitle('Stellar Testnet Wallet Address')
      .setHelpText('e.g. G... starting address from Freighter wallet')
      .setRequired(true);

  // 4. Role Selection
  form.addMultipleChoiceItem()
      .setTitle('How did you test SkillX?')
      .setChoices([
        form.newChoice('As a Client (Posting jobs & escrow funding)'),
        form.newChoice('As a Freelancer (Accepting jobs & milestone submission)'),
        form.newChoice('Both / General Tester')
      ])
      .setRequired(true);

  // 5. Platform Rating (1 to 5 Stars)
  form.addScaleItem()
      .setTitle('Overall Platform Rating')
      .setBounds(1, 5)
      .setLabels('1 - Needs Work', '5 - Excellent')
      .setRequired(true);

  // 6. Best Feature
  form.addParagraphTextItem()
      .setTitle('What feature did you like most?')
      .setHelpText('e.g. Soroban milestone escrow, 3D mechanical gear animation, profile cards...');

  // 7. Bugs or UI Suggestions
  form.addParagraphTextItem()
      .setTitle('What bugs or UI issues did you encounter?');

  // 8. Requested Features
  form.addParagraphTextItem()
      .setTitle('What feature would you like to see next?');

  // Print Form Edit and Published URLs in logger
  Logger.log('🎉 Form Created Successfully!');
  Logger.log('Edit URL: ' + form.getEditUrl());
  Logger.log('Published Form Link to Share: ' + form.getPublishedUrl());
}
