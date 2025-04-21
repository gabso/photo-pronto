'use server'
import { google } from 'googleapis';

export const  createPicker =(token: string) =>{
    if (!token) {
      console.error('OAuth token is missing');
      return;
    }

    const picker = new google.picker.PickerBuilder()
      .addView(google.picker.ViewId.DOCS)
      .setOAuthToken(token)
      .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
      .setAppId(process.env.NEXT_PUBLIC_GOOGLE_APP_ID)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          console.log('Selected file:', data.docs[0].id);
        }
      })
      .build();
    picker.setVisible(true);
  };