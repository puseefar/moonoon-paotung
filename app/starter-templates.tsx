import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { Card } from '@/components/ui/Card';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useColorScheme } from '@/components/useColorScheme';
import {
  starterTemplateService,
  type GuidedTemplateAnswerMap,
  type GuidedTemplateQuestion,
  type GuidedTemplateQuestionId,
  type StarterTemplateRecommendation,
  type StarterTemplate,
  type StarterTemplateGroup,
} from '@/services/starterTemplateService';

type TemplateFilter = 'all' | 'popular' | StarterTemplateGroup;

const FILTERS: Array<{ id: TemplateFilter; label: string }> = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'popular', label: 'ยอดนิยม' },
  { id: 'general', label: 'บุคคลทั่วไป' },
  { id: 'commerce', label: 'ค้าขาย/ธุรกิจ' },
  { id: 'freelance', label: 'อาชีพอิสระ' },
  { id: 'agriculture', label: 'เกษตร/บริการ' },
  { id: 'family', label: 'ครอบครัว' },
];

const GROUP_SECTIONS: Array<{
  id: StarterTemplateGroup;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'general',
    title: 'บุคคลทั่วไป',
    subtitle: 'นักศึกษาและคนทำงานที่มีรูปแบบรายรับรายจ่ายประจำ',
  },
  {
    id: 'commerce',
    title: 'ค้าขาย/ธุรกิจ',
    subtitle: 'เหมาะกับร้านค้า ธุรกิจส่วนตัว และรายได้จากยอดขาย',
  },
  {
    id: 'freelance',
    title: 'อาชีพอิสระ',
    subtitle: 'เหมาะกับฟรีแลนซ์ Creator ศิลปิน และสายรายได้หลายช่องทาง',
  },
  {
    id: 'agriculture',
    title: 'เกษตร/บริการ',
    subtitle: 'เหมาะกับเกษตรกร ไรเดอร์ และงานบริการภาคสนาม',
  },
  {
    id: 'family',
    title: 'ครอบครัว/เฉพาะทาง',
    subtitle: 'เหมาะกับคนที่ดูแลรายรับรายจ่ายทั้งบ้าน',
  },
];

const MAX_VISIBLE_TAGS = 5;
const MAX_CUSTOM_TEMPLATE_SELECTION = 4;
const CUSTOM_BUILDER_APPLY_ID = '__custom_builder__';

function normalizeSearch(input: string) {
  return input.normalize('NFC').trim().toLowerCase();
}

function matchesTemplate(template: StarterTemplate, query: string) {
  if (!query) return true;

  const haystack = [
    template.name,
    template.description,
    template.targetUser,
    ...template.helperTags,
    ...template.sampleEntries,
    ...template.categories.map((category) => category.name),
  ]
    .join(' ')
    .normalize('NFC')
    .toLowerCase();

  return haystack.includes(query);
}

export default function StarterTemplatesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showSnackbar } = useSnackbar();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState<TemplateFilter>('all');
  const [showGuidedPicker, setShowGuidedPicker] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customStarterName, setCustomStarterName] = useState('ชุดเริ่มต้นของฉัน');
  const [selectedCustomTemplateIds, setSelectedCustomTemplateIds] = useState<string[]>([]);
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedAnswers, setGuidedAnswers] = useState<GuidedTemplateAnswerMap>({});

  const templates = useMemo(() => starterTemplateService.getTemplates(), []);
  const popularTemplates = useMemo(() => starterTemplateService.getPopularTemplates(6), []);
  const guidedQuestions = useMemo(() => starterTemplateService.getGuidedQuestions(), []);
  const totalCategoryCount = useMemo(
    () => templates.reduce((sum, template) => sum + template.categories.length, 0),
    [templates]
  );

  const filteredBySearch = useMemo(() => {
    const query = normalizeSearch(searchText);
    return templates.filter((template) => matchesTemplate(template, query));
  }, [searchText, templates]);

  const visibleTemplates = useMemo(() => {
    if (activeFilter === 'all') return filteredBySearch;
    if (activeFilter === 'popular') {
      const visibleIds = new Set(filteredBySearch.map((template) => template.id));
      return popularTemplates.filter((template) => visibleIds.has(template.id));
    }
    return filteredBySearch.filter((template) => template.group === activeFilter);
  }, [activeFilter, filteredBySearch, popularTemplates]);

  const popularSection = useMemo(() => {
    if (activeFilter !== 'all') return [];
    if (normalizeSearch(searchText)) return [];
    return popularTemplates;
  }, [activeFilter, popularTemplates, searchText]);

  const groupedSections = useMemo(() => {
    if (activeFilter === 'popular') {
      return [
        {
          title: 'ยอดนิยม',
          subtitle: 'ชุดเริ่มต้นที่คนใช้บ่อยและเหมาะกับการเริ่มต้นเร็วที่สุด',
          templates: visibleTemplates,
        },
      ];
    }

    if (activeFilter === 'all') {
      return GROUP_SECTIONS.map((section) => ({
        ...section,
        templates: visibleTemplates.filter((template) => template.group === section.id),
      })).filter((section) => section.templates.length > 0);
    }

    const section = GROUP_SECTIONS.find((item) => item.id === activeFilter);
    if (!section) return [];

    return [
      {
        ...section,
        templates: visibleTemplates,
      },
    ].filter((item) => item.templates.length > 0);
  }, [activeFilter, visibleTemplates]);

  const isGuidedComplete = guidedQuestions.every((question) => Boolean(guidedAnswers[question.id]));
  const guidedRecommendation = useMemo<StarterTemplateRecommendation | null>(
    () => starterTemplateService.recommendTemplate(guidedAnswers),
    [guidedAnswers]
  );
  const currentGuidedQuestion = guidedQuestions[Math.min(guidedStep, guidedQuestions.length - 1)] ?? null;
  const answeredGuidedCount = guidedQuestions.filter((question) => Boolean(guidedAnswers[question.id])).length;
  const selectedCustomTemplates = useMemo(
    () => templates.filter((template) => selectedCustomTemplateIds.includes(template.id)),
    [selectedCustomTemplateIds, templates]
  );
  const customTemplatePreview = useMemo(() => {
    const uniqueCategories = new Set<string>();
    const sampleEntries: string[] = [];
    let incomeCount = 0;
    let expenseCount = 0;

    for (const template of selectedCustomTemplates) {
      for (const category of template.categories) {
        const categoryKey = `${category.type}:${category.name.trim().toLowerCase()}`;
        if (uniqueCategories.has(categoryKey)) continue;

        uniqueCategories.add(categoryKey);
        if (category.type === 'income') {
          incomeCount += 1;
        } else {
          expenseCount += 1;
        }
      }

      for (const entry of template.sampleEntries) {
        if (sampleEntries.includes(entry)) continue;
        sampleEntries.push(entry);
      }
    }

    return {
      totalCategories: uniqueCategories.size,
      incomeCount,
      expenseCount,
      sampleEntries: sampleEntries.slice(0, 4),
    };
  }, [selectedCustomTemplates]);

  const applyTemplateSelection = async (
    templateIds: string[],
    profileName?: string,
    applyingKey?: string
  ) => {
    setApplyingId(applyingKey ?? templateIds[0] ?? null);
    try {
      const result = templateIds.length === 1
        ? await starterTemplateService.applyTemplate(templateIds[0])
        : await starterTemplateService.applyTemplateBundle(templateIds);
      const activeProfile = await starterTemplateService.saveActiveQuickAddProfile(
        templateIds,
        profileName
      );
      showSnackbar({
        title: 'เพิ่ม Starter Template แล้ว',
        message:
          `สร้างหมวดใหม่ ${result.created} รายการ ข้ามหมวดเดิม ${result.skipped} รายการ ` +
          `และตั้ง Quick Add เป็น "${activeProfile.name}" แล้ว`,
        variant: 'success',
        durationMs: 3400,
      });
      return true;
    } catch (error) {
      showSnackbar({
        title: 'เพิ่ม Template ไม่สำเร็จ',
        message: 'ไม่สามารถเพิ่ม Starter Template ได้ กรุณาลองใหม่',
        variant: 'error',
        durationMs: 3400,
      });
      return false;
    } finally {
      setApplyingId(null);
    }
  };

  const applyTemplate = async (template: StarterTemplate) => {
    await applyTemplateSelection([template.id], undefined, template.id);
  };

  const resetGuidedPicker = () => {
    setGuidedAnswers({});
    setGuidedStep(0);
  };

  const getSelectedOption = (question: GuidedTemplateQuestion) =>
    question.options.find((option) => option.id === guidedAnswers[question.id]) ?? null;

  const handleSelectGuidedOption = (
    questionId: GuidedTemplateQuestionId,
    optionId: string
  ) => {
    setGuidedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));

    setGuidedStep((prev) => Math.min(prev + 1, guidedQuestions.length - 1));
  };

  const handleCreateCustom = () => {
    setShowCustomBuilder((prev) => !prev);
  };

  const toggleCustomTemplateSelection = (templateId: string) => {
    if (selectedCustomTemplateIds.includes(templateId)) {
      setSelectedCustomTemplateIds((prev) => prev.filter((id) => id !== templateId));
      return;
    }

    if (selectedCustomTemplateIds.length >= MAX_CUSTOM_TEMPLATE_SELECTION) {
      showSnackbar({
        title: 'เลือกได้สูงสุด 4 ชุด',
        message: 'เพื่อให้ Quick Add เดาได้แม่นและไม่กว้างเกินไป',
        variant: 'warning',
        durationMs: 2800,
      });
      return;
    }

    setSelectedCustomTemplateIds((prev) => [...prev, templateId]);
  };

  const resetCustomBuilder = () => {
    setSelectedCustomTemplateIds([]);
    setCustomStarterName('ชุดเริ่มต้นของฉัน');
  };

  const handleApplyCustomBuilder = async () => {
    if (!selectedCustomTemplateIds.length) {
      showSnackbar({
        title: 'ยังไม่ได้เลือกชุด',
        message: 'เลือกอย่างน้อย 1 Starter Template ก่อนสร้างชุดของคุณเอง',
        variant: 'warning',
        durationMs: 2800,
      });
      return;
    }

    const didApply = await applyTemplateSelection(
      selectedCustomTemplateIds,
      customStarterName.trim() || 'ชุดเริ่มต้นของฉัน',
      CUSTOM_BUILDER_APPLY_ID
    );

    if (didApply) {
      resetCustomBuilder();
      setShowCustomBuilder(false);
    }
  };

  const handleGuidedPick = () => {
    setShowGuidedPicker(true);
    const firstUnansweredIndex = guidedQuestions.findIndex((question) => !guidedAnswers[question.id]);
    setGuidedStep(firstUnansweredIndex >= 0 ? firstUnansweredIndex : guidedQuestions.length - 1);
  };

  const renderTemplateCard = (template: StarterTemplate) => {
    const isApplying = applyingId === template.id;
    const visibleTags = template.helperTags.slice(0, MAX_VISIBLE_TAGS);
    const hiddenTagCount = Math.max(template.helperTags.length - visibleTags.length, 0);
    const incomeCount = template.categories.filter((category) => category.type === 'income').length;
    const expenseCount = template.categories.filter((category) => category.type === 'expense').length;

    return (
      <Card key={template.id} variant="elevated" style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              backgroundColor: colors.tint + '14',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 28 }}>{template.icon}</Text>
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 8,
              }}>
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.text }}>
                {template.name}
              </Text>
              <View
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  backgroundColor: colors.border + '66',
                }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
                  {template.categories.length} หมวด
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
              {template.description}
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
              {template.targetUser}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: colors.income + '12',
            }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.income }}>
              รายรับ {incomeCount}
            </Text>
          </View>
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: colors.expense + '12',
            }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.expense }}>
              รายจ่าย {expenseCount}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {visibleTags.map((tag) => (
            <View
              key={`${template.id}-${tag}`}
              style={{
                borderRadius: 11,
                backgroundColor: colors.background,
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>
                {tag}
              </Text>
            </View>
          ))}
          {hiddenTagCount > 0 ? (
            <View
              style={{
                borderRadius: 11,
                backgroundColor: colors.border + '66',
                paddingHorizontal: 10,
                paddingVertical: 7,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
                + อีก {hiddenTagCount} หมวด
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 4,
          }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary }}>
            ตัวอย่างที่ใช้บ่อย
          </Text>
          <Text style={{ fontSize: 12, lineHeight: 18, color: colors.text }}>
            {template.sampleEntries.slice(0, 2).map((entry) => `“${entry}”`).join(' • ')}
          </Text>
        </View>

        <Pressable
          onPress={() => applyTemplate(template)}
          disabled={Boolean(applyingId)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderRadius: 14,
            paddingVertical: 14,
            backgroundColor: applyingId
              ? '#B0B0B0'
              : pressed
                ? colors.tintDark
                : colors.tint,
          })}>
          <FontAwesome name="plus-circle" size={16} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
            {isApplying ? 'กำลังเพิ่ม...' : 'ใช้ Template นี้'}
          </Text>
        </Pressable>
      </Card>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: 'Starter Templates',
          headerStyle: { backgroundColor: colors.tint },
          headerTintColor: '#FFF',
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Card
          variant="elevated"
          style={{
            gap: 12,
            backgroundColor: colors.cardBackground,
          }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>
              เลือกชุดเริ่มต้นที่ใกล้ชีวิตคุณ
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
              ระบบจะเพิ่มหมวดพร้อมใช้ให้ทันที และช่วยเดารายรับรายจ่ายให้แม่นขึ้นตั้งแต่วันแรก
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <View
              style={{
                borderRadius: 12,
                backgroundColor: colors.tint + '12',
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.tint }}>
                {templates.length} อาชีพหลัก
              </Text>
            </View>
            <View
              style={{
                borderRadius: 12,
                backgroundColor: colors.income + '12',
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.income }}>
                {totalCategoryCount} หมวดพร้อมใช้
              </Text>
            </View>
            <View
              style={{
                borderRadius: 12,
                backgroundColor: colors.transfer + '12',
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.transfer }}>
                Quick Add แม่นขึ้น
              </Text>
            </View>
          </View>
        </Card>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.cardBackground,
            paddingHorizontal: 14,
            paddingVertical: 4,
          }}>
          <FontAwesome name="search" size={16} color={colors.textSecondary} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="ค้นหาอาชีพหรือกิจกรรม..."
            placeholderTextColor={colors.textSecondary}
            style={{
              flex: 1,
              fontSize: 15,
              color: colors.text,
              paddingVertical: 12,
            }}
          />
          {searchText ? (
            <Pressable onPress={() => setSearchText('')}>
              <FontAwesome name="times-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <Pressable
                key={filter.id}
                onPress={() => setActiveFilter(filter.id)}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: isActive ? colors.tint : colors.cardBackground,
                  borderWidth: 1,
                  borderColor: isActive ? colors.tint : colors.border,
                }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '800',
                    color: isActive ? '#FFF' : colors.textSecondary,
                  }}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
          พบ {visibleTemplates.length} ชุดเริ่มต้น
        </Text>

        {showGuidedPicker ? (
          <Card
            variant="elevated"
            style={{
              gap: 14,
              borderWidth: 1,
              borderColor: colors.tint + '33',
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>
                  ให้ระบบช่วยเลือก
                </Text>
                <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                  ตอบ 3 คำถามสั้น ๆ แล้วระบบจะเลือก Starter Template ที่ใกล้กับชีวิตคุณที่สุด
                </Text>
              </View>
              <Pressable onPress={() => setShowGuidedPicker(false)}>
                <FontAwesome name="times-circle" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {guidedQuestions.map((question, index) => {
                const isDone = Boolean(guidedAnswers[question.id]);
                const isCurrent = !isGuidedComplete && index === guidedStep;

                return (
                  <View
                    key={question.id}
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: isDone
                        ? colors.tint
                        : isCurrent
                          ? colors.tint + '55'
                          : colors.border,
                    }}
                  />
                );
              })}
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
              ตอบแล้ว {answeredGuidedCount}/{guidedQuestions.length} ข้อ
            </Text>

            {answeredGuidedCount > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {guidedQuestions.map((question) => {
                  const selectedOption = getSelectedOption(question);
                  if (!selectedOption) return null;

                  return (
                    <View
                      key={`answer-${question.id}`}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        backgroundColor: colors.tint + '10',
                        borderWidth: 1,
                        borderColor: colors.tint + '22',
                      }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.tint }}>
                        {selectedOption.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {!isGuidedComplete && currentGuidedQuestion ? (
              <View style={{ gap: 12 }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>
                    ข้อ {guidedStep + 1}: {currentGuidedQuestion.title}
                  </Text>
                  <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                    {currentGuidedQuestion.helper}
                  </Text>
                </View>

                <View style={{ gap: 8 }}>
                  {currentGuidedQuestion.options.map((option) => {
                    const isSelected = guidedAnswers[currentGuidedQuestion.id] === option.id;
                    return (
                      <Pressable
                        key={`${currentGuidedQuestion.id}-${option.id}`}
                        onPress={() => handleSelectGuidedOption(currentGuidedQuestion.id, option.id)}
                        style={({ pressed }) => ({
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.tint : colors.border,
                          backgroundColor: isSelected
                            ? colors.tint + '12'
                            : pressed
                              ? colors.border + '66'
                              : colors.cardBackground,
                          paddingHorizontal: 14,
                          paddingVertical: 13,
                        })}>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '800',
                            color: isSelected ? colors.tint : colors.text,
                          }}>
                          {option.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            lineHeight: 18,
                            color: colors.textSecondary,
                            marginTop: 4,
                          }}>
                          {option.description}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => setGuidedStep((prev) => Math.max(prev - 1, 0))}
                    disabled={guidedStep === 0}
                    style={({ pressed }) => ({
                      flex: 1,
                      borderRadius: 14,
                      paddingVertical: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: guidedStep === 0 ? colors.border : colors.tint,
                      backgroundColor:
                        guidedStep === 0
                          ? colors.border + '44'
                          : pressed
                            ? colors.tint + '10'
                            : colors.cardBackground,
                    })}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '800',
                        color: guidedStep === 0 ? colors.textSecondary : colors.tint,
                      }}>
                      ย้อนกลับ
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={resetGuidedPicker}
                    style={({ pressed }) => ({
                      flex: 1,
                      borderRadius: 14,
                      paddingVertical: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: pressed ? colors.border + '55' : colors.cardBackground,
                    })}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textSecondary }}>
                      เริ่มตอบใหม่
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {isGuidedComplete && guidedRecommendation ? (
              <View style={{ gap: 14 }}>
                <View
                  style={{
                    borderRadius: 18,
                    backgroundColor: colors.tint + '10',
                    padding: 14,
                    gap: 10,
                    borderWidth: 1,
                    borderColor: colors.tint + '22',
                  }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.tint }}>
                    Template ที่เหมาะกับคุณ
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 18,
                        backgroundColor: '#FFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Text style={{ fontSize: 30 }}>{guidedRecommendation.template.icon}</Text>
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>
                        {guidedRecommendation.template.name}
                      </Text>
                      <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                        {guidedRecommendation.template.description}
                      </Text>
                      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                        {guidedRecommendation.template.targetUser}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                    ระบบเลือกจากคำตอบของคุณ
                  </Text>
                  {guidedRecommendation.reasons.map((reason) => (
                    <View
                      key={reason}
                      style={{
                        borderRadius: 12,
                        backgroundColor: colors.background,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      }}>
                      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.text }}>
                        {reason}
                      </Text>
                    </View>
                  ))}
                </View>

                <View
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 4,
                  }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary }}>
                    ตัวอย่างที่น่าจะใช้บ่อย
                  </Text>
                  <Text style={{ fontSize: 12, lineHeight: 18, color: colors.text }}>
                    {guidedRecommendation.template.sampleEntries
                      .slice(0, 2)
                      .map((entry) => `“${entry}”`)
                      .join(' • ')}
                  </Text>
                </View>

                {guidedRecommendation.secondaryTemplate &&
                guidedRecommendation.secondaryScore >= guidedRecommendation.score - 2 ? (
                  <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                    ถ้าคุณมีอีกบทบาทหนึ่งในชีวิตประจำวัน อาจใกล้กับ
                    {' '}
                    {guidedRecommendation.secondaryTemplate.name}
                    {' '}
                    ด้วยเช่นกัน
                  </Text>
                ) : null}

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => applyTemplate(guidedRecommendation.template)}
                    disabled={Boolean(applyingId)}
                    style={({ pressed }) => ({
                      flex: 1,
                      borderRadius: 14,
                      paddingVertical: 13,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        applyingId === guidedRecommendation.template.id
                          ? '#B0B0B0'
                          : pressed
                            ? colors.tintDark
                            : colors.tint,
                    })}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF' }}>
                      {applyingId === guidedRecommendation.template.id
                        ? 'กำลังเพิ่ม...'
                        : 'ใช้ Template แนะนำนี้'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={resetGuidedPicker}
                    style={({ pressed }) => ({
                      flex: 1,
                      borderRadius: 14,
                      paddingVertical: 13,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.tint,
                      backgroundColor: pressed ? colors.tint + '10' : colors.cardBackground,
                    })}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.tint }}>
                      ตอบใหม่อีกครั้ง
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </Card>
        ) : null}

        {popularSection.length > 0 ? (
          <View style={{ gap: 10 }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>
                ยอดนิยม
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                เหมาะกับผู้ใช้ส่วนใหญ่และช่วยเริ่มต้นได้ไวที่สุด
              </Text>
            </View>
            {popularSection.map(renderTemplateCard)}
          </View>
        ) : null}

        {groupedSections.map((section) => (
          <View key={section.title} style={{ gap: 10 }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>
                {section.title}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {section.subtitle}
              </Text>
            </View>
            {section.templates.map(renderTemplateCard)}
          </View>
        ))}

        {!visibleTemplates.length ? (
          <Card variant="elevated" style={{ gap: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
              ยังไม่พบ Template ที่ตรงคำค้น
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
              ลองค้นหาด้วยคำอย่าง `ร้านอาหาร`, `เกษตร`, `ฟรีแลนซ์` หรือ `ขายของ`
            </Text>
          </Card>
        ) : null}

        <Card variant="elevated" style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>
              ยังไม่แน่ใจว่าจะเลือกอันไหนดี?
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
              คุณสามารถเริ่มจากชุดยอดนิยมก่อน หรือใช้ตัวช่วยเพื่อให้ระบบเลือกแนวทางที่เหมาะกับคุณ
            </Text>
          </View>

          <Pressable
            onPress={handleGuidedPick}
            style={({ pressed }) => ({
              borderRadius: 14,
              paddingVertical: 13,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.tintDark : colors.tint,
            })}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF' }}>
              ให้ระบบช่วยเลือก
            </Text>
          </Pressable>

          <Pressable
            onPress={handleCreateCustom}
            style={({ pressed }) => ({
              borderRadius: 14,
              paddingVertical: 13,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.tint,
              backgroundColor: pressed ? colors.tint + '10' : colors.cardBackground,
            })}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.tint }}>
              {showCustomBuilder ? 'ซ่อนตัวสร้างเอง' : 'สร้างชุดเริ่มต้นเอง'}
            </Text>
          </Pressable>
        </Card>

        {showCustomBuilder ? (
          <Card
            variant="elevated"
            style={{
              gap: 14,
              borderWidth: 1,
              borderColor: colors.tint + '22',
            }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>
                สร้างชุดเริ่มต้นของคุณเอง
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                เลือกได้หลายอาชีพที่ใกล้กับชีวิตจริง ระบบจะรวมหมวดให้และบันทึกโปรไฟล์ช่วยเดา Quick Add ไปพร้อมกัน
              </Text>
            </View>

            <View
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.cardBackground,
                paddingHorizontal: 14,
                paddingVertical: 4,
              }}>
              <TextInput
                value={customStarterName}
                onChangeText={setCustomStarterName}
                placeholder="ตั้งชื่อชุด เช่น ร้านเล็ก + ฟรีแลนซ์"
                placeholderTextColor={colors.textSecondary}
                style={{
                  fontSize: 15,
                  color: colors.text,
                  paddingVertical: 12,
                }}
              />
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
              เลือกได้สูงสุด {MAX_CUSTOM_TEMPLATE_SELECTION} ชุด
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {templates.map((template) => {
                const isSelected = selectedCustomTemplateIds.includes(template.id);

                return (
                  <Pressable
                    key={`custom-${template.id}`}
                    onPress={() => toggleCustomTemplateSelection(template.id)}
                    style={({ pressed }) => ({
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: isSelected
                        ? colors.tint
                        : pressed
                          ? colors.border + '66'
                          : colors.cardBackground,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.tint : colors.border,
                    })}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: isSelected ? '#FFF' : colors.text,
                      }}>
                      {template.icon} {template.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedCustomTemplates.length > 0 ? (
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  padding: 14,
                  gap: 10,
                }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: colors.text }}>
                    พรีวิวชุดที่กำลังสร้าง
                  </Text>
                  <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                    {selectedCustomTemplates.map((template) => template.name).join(' • ')}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      backgroundColor: colors.income + '12',
                    }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.income }}>
                      รายรับ {customTemplatePreview.incomeCount}
                    </Text>
                  </View>
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      backgroundColor: colors.expense + '12',
                    }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.expense }}>
                      รายจ่าย {customTemplatePreview.expenseCount}
                    </Text>
                  </View>
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      backgroundColor: colors.tint + '12',
                    }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.tint }}>
                      รวม {customTemplatePreview.totalCategories} หมวด
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 12, lineHeight: 18, color: colors.text }}>
                  ตัวอย่าง: {customTemplatePreview.sampleEntries.join(' • ')}
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={handleApplyCustomBuilder}
                disabled={applyingId === CUSTOM_BUILDER_APPLY_ID}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: 14,
                  paddingVertical: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    applyingId === CUSTOM_BUILDER_APPLY_ID
                      ? '#B0B0B0'
                      : pressed
                        ? colors.tintDark
                        : colors.tint,
                })}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF' }}>
                  {applyingId === CUSTOM_BUILDER_APPLY_ID
                    ? 'กำลังสร้าง...'
                    : 'ใช้ชุดที่สร้างเอง'}
                </Text>
              </Pressable>

              <Pressable
                onPress={resetCustomBuilder}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: 14,
                  paddingVertical: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.border + '55' : colors.cardBackground,
                })}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textSecondary }}>
                  ล้างการเลือก
                </Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}
