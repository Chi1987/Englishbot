module.exports = function createSuccessMessage(pronunciationFeedback) {
  let successText = "よくできました！この英文は正しく書けています。";
  if (pronunciationFeedback) {
    successText += "\n\n【発音フィードバック】\n" + pronunciationFeedback.feedback;
    if (pronunciationFeedback.tips) {
      successText += "\n\n【発音のコツ】\n" + pronunciationFeedback.tips;
    }
  }
  
  const messages = [];
  messages.push({
    type: "text",
    text: successText
  });
  messages.push({
    type: "image",
    originalContentUrl: "https://firebasestorage.googleapis.com/v0/b/stripe-payment-server-10493.firebasestorage.app/o/well_done_stamp.png?alt=media&token=427a3d33-b025-49e9-9d12-b32c011c3864",
    previewImageUrl: "https://firebasestorage.googleapis.com/v0/b/stripe-payment-server-10493.firebasestorage.app/o/well_done_stamp.png?alt=media&token=427a3d33-b025-49e9-9d12-b32c011c3864"
  });
  
  return messages;
};