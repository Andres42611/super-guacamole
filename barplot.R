# Load necessary libraries
library(ggplot2)
library(jsonlite)
library(dplyr)
library(viridis)  # Scientific color palette
library(gridExtra) # Arrange plots for inline display

# Load JSON data
val_loss <- fromJSON("reg_val_loss_dict.json")
val_mre <- fromJSON("reg_val_mre_dict.json")
val_loss_ci <- fromJSON("reg_val_loss_ci_dict.json")
val_mre_ci <- fromJSON("reg_val_mre_ci_dict.json")

# Convert lists to data frames
df_loss <- data.frame(
  Model = names(val_loss),
  Loss = unlist(val_loss)
)

df_mre <- data.frame(
  Model = names(val_mre),
  MRE = unlist(val_mre)
)

df_loss_ci <- data.frame(
  Model = names(val_loss_ci),
  Lower = sapply(val_loss_ci, function(x) x[1]),
  Upper = sapply(val_loss_ci, function(x) x[2])
)

df_mre_ci <- data.frame(
  Model = names(val_mre_ci),
  Lower = sapply(val_mre_ci, function(x) x[1]),
  Upper = sapply(val_mre_ci, function(x) x[2])
)

# Merge confidence intervals with main data
df_loss <- left_join(df_loss, df_loss_ci, by = "Model")
df_mre <- left_join(df_mre, df_mre_ci, by = "Model")

# Identify DNN model (assuming "DNN" is the name of the model)
df_loss$HasCI <- df_loss$Model != "DNN"
df_mre$HasCI <- df_mre$Model != "DNN"

# Suppress messages and warnings
options(warn=-1)

# Define scientific-style color palette
color_palette <- scale_fill_viridis_d(option = "A", begin = 0.2, end = 0.8)

# Create validation loss plot
p_loss <- ggplot(df_loss, aes(x = Model, y = Loss, fill = Model)) +
  geom_bar(stat = "identity", color = "black", width = 0.6) +
  geom_errorbar(data = subset(df_loss, HasCI), aes(ymin = Lower, ymax = Upper), width = 0.2, linewidth = 1) +
  theme_classic(base_size = 16) +
  labs(title = "Validation Loss Across Regression Models",
       y = "Validation Loss",
       x = "Regression Model") +
  color_palette +
  theme(
    legend.position = "none",
    axis.text.x = element_text(angle = 45, hjust = 1, vjust = 1, size = 14),
    axis.text.y = element_text(size = 14),
    axis.title = element_text(size = 16),
    plot.title = element_text(size = 18, face = "bold")
  )

# Create mean relative error (MRE) plot
p_mre <- ggplot(df_mre, aes(x = Model, y = MRE, fill = Model)) +
  geom_bar(stat = "identity", color = "black", width = 0.6) +
  geom_errorbar(data = subset(df_mre, HasCI), aes(ymin = Lower, ymax = Upper), width = 0.2, linewidth = 1) +
  theme_classic(base_size = 16) +
  labs(title = "Mean Relative Error Across Regression Models",
       y = "Mean Relative Error (%)",
       x = "Regression Model") +
  color_palette +
  theme(
    legend.position = "none",
    axis.text.x = element_text(angle = 45, hjust = 1, vjust = 1, size = 14),
    axis.text.y = element_text(size = 14),
    axis.title = element_text(size = 16),
    plot.title = element_text(size = 18, face = "bold")
  )

# Print plots to Colab output (scientific format)
grid.arrange(p_loss, p_mre, ncol=1)

